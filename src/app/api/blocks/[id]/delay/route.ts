import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db";
import { requireBlockOwner } from "@/lib/access";
import { downstreamBlockIds, notify } from "@/lib/delays";

export const dynamic = "force-dynamic";

// The owner's decision on a reported delay:
// "shift"  - accept it and move every unfinished downstream block (and its accepted bid) by the delay
// "reopen" - reopen the delayed block for bids to keep the original schedule
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const blockId = Number(id);
  const owner = await requireBlockOwner(blockId);
  if (owner instanceof NextResponse) return owner;

  const { action } = await request.json();
  if (action !== "shift" && action !== "reopen") {
    return NextResponse.json({ error: "action must be 'shift' or 'reopen'" }, { status: 400 });
  }

  const block = await queryOne("SELECT * FROM blocks WHERE id = ?", [blockId]);
  if (!block || block.pending_delay_days == null) {
    return NextResponse.json({ error: "This block has no delay waiting for a decision" }, { status: 400 });
  }
  const projectId = Number(block.project_id);
  const title = String(block.title);
  const delayDays = Number(block.pending_delay_days);
  const downstream = await downstreamBlockIds(blockId, projectId);
  const assigned = await queryOne(
    "SELECT id, trade_id FROM bids WHERE block_id = ? AND status IN ('accepted', 'needs_confirmation') LIMIT 1",
    [blockId]
  );

  if (action === "reopen" && block.status === "completed") {
    return NextResponse.json({ error: "This block is already complete; accept the delay instead" }, { status: 400 });
  }

  let shifted = 0;
  if (action === "shift") {
    if (delayDays > 0 && downstream.length > 0) {
      const offset = `+${delayDays} days`;
      for (const dsId of downstream) {
        const ds = await queryOne("SELECT id, title, status FROM blocks WHERE id = ?", [dsId]);
        if (!ds || ds.status === "completed") continue;
        shifted++;

        await execute(
          `UPDATE blocks SET
             desired_start_date = date(desired_start_date, ?),
             desired_completion_date = date(desired_completion_date, ?),
             estimated_completion_date = date(estimated_completion_date, ?),
             updated_at = datetime('now')
           WHERE id = ?`,
          [offset, offset, offset, dsId]
        );

        // The awarded trade's dates move too; they confirm the new dates or revise their bid
        const awarded = await query(
          "SELECT id, trade_id, start_date, duration_days FROM bids WHERE block_id = ? AND status IN ('accepted', 'needs_confirmation')",
          [dsId]
        );
        for (const bid of awarded) {
          await execute(
            "UPDATE bids SET start_date = date(start_date, ?), status = 'needs_confirmation', delay_confirmed = 0, updated_at = datetime('now') WHERE id = ?",
            [offset, Number(bid.id)]
          );
          const moved = await queryOne("SELECT start_date FROM bids WHERE id = ?", [Number(bid.id)]);
          const plural = delayDays !== 1 ? "s" : "";
          await notify(
            Number(bid.trade_id), "delay_confirmation_needed", "New dates - please confirm",
            `"${title}" was delayed ${delayDays} day${plural} and the owner shifted the schedule. ` +
              (moved?.start_date
                ? `"${ds.title}" now starts ${moved.start_date}. `
                : `The dates for "${ds.title}" moved ${delayDays} day${plural} later. `) +
              "Please confirm the new dates or revise your bid.",
            projectId, dsId
          );
        }

        const bidders = await query(
          "SELECT DISTINCT trade_id FROM bids WHERE block_id = ? AND status = 'pending'",
          [dsId]
        );
        for (const bidder of bidders) {
          await notify(
            Number(bidder.trade_id), "schedule_shifted", "Target dates moved",
            `The owner moved the target dates for "${ds.title}" by ${delayDays} day${delayDays !== 1 ? "s" : ""} after an upstream delay. You may want to update your bid's dates.`,
            projectId, dsId
          );
        }
      }
    }

    await execute(
      `UPDATE blocks SET status = CASE WHEN status = 'delayed' THEN 'in_progress' ELSE status END,
         delay_baseline_date = NULL, pending_delay_days = NULL, updated_at = datetime('now') WHERE id = ?`,
      [blockId]
    );
    if (assigned) {
      await notify(
        Number(assigned.trade_id), "delay_accepted", "Delay accepted",
        `The owner accepted the new finish date for "${title}" (${block.estimated_completion_date}).`,
        projectId, blockId
      );
    }
  } else {
    // Back to bidding with the original dates; the current trade's bid stays in the running
    await execute(
      `UPDATE blocks SET status = 'open_for_bids', estimated_completion_date = NULL,
         delay_baseline_date = NULL, pending_delay_days = NULL, updated_at = datetime('now') WHERE id = ?`,
      [blockId]
    );
    if (assigned) {
      await execute("UPDATE bids SET status = 'pending', updated_at = datetime('now') WHERE id = ?", [Number(assigned.id)]);
      await notify(
        Number(assigned.trade_id), "bid_reopened", "Block reopened for bids",
        `To keep the project on schedule, the owner reopened "${title}" for bids. Your bid is pending again; you can revise it.`,
        projectId, blockId
      );
    }
    if (downstream.length > 0) {
      const placeholders = downstream.map(() => "?").join(",");
      const affected = await query(
        `SELECT DISTINCT bi.trade_id, b.id as block_id, b.title as block_title FROM bids bi JOIN blocks b ON b.id = bi.block_id
         WHERE bi.block_id IN (${placeholders}) AND bi.status IN ('accepted', 'needs_confirmation')`,
        downstream
      );
      for (const a of affected) {
        await notify(
          Number(a.trade_id), "schedule_kept", "Schedule unchanged",
          `The owner is rebidding "${title}" to stay on schedule. Your dates for "${a.block_title}" are unchanged.`,
          projectId, Number(a.block_id)
        );
      }
    }
  }

  return NextResponse.json({ action, delay_days: delayDays, shifted_blocks: shifted });
}
