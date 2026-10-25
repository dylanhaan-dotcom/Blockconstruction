import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db";
import { getViewer } from "@/lib/access";
import { bidFinish, daysBetween, toDay } from "@/lib/schedule";
import { downstreamBlockIds, notify } from "@/lib/delays";

export const dynamic = "force-dynamic";

const PROGRESS_STATUSES = ["in_progress", "completed", "delayed"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const blockId = Number(id);
  const body = await request.json();
  const { status, notes, new_estimated_completion } = body;

  if (!PROGRESS_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Only the trade doing the work can report progress
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const myBid = await queryOne(
    "SELECT start_date, duration_days FROM bids WHERE block_id = ? AND trade_id = ? AND status IN ('accepted', 'needs_confirmation')",
    [blockId, viewer.id]
  );
  if (!myBid) {
    return NextResponse.json({ error: "Only the assigned trade can update progress" }, { status: 403 });
  }

  const block = await queryOne("SELECT * FROM blocks WHERE id = ?", [blockId]);
  if (!block) return NextResponse.json({ error: "Block not found" }, { status: 404 });
  const projectId = Number(block.project_id);

  if (status === "delayed" && !new_estimated_completion) {
    return NextResponse.json({ error: "A new estimated completion date is required when reporting a delay" }, { status: 400 });
  }

  await execute(`
    INSERT INTO progress_updates (block_id, trade_id, status, notes, new_estimated_completion)
    VALUES (?, ?, ?, ?, ?)
  `, [blockId, viewer.id, status, notes || null, new_estimated_completion || null]);

  await execute("UPDATE blocks SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, blockId]);

  if (status === "delayed") {
    // Measure the delay against the finish date in place before the first unresolved delay report
    const baseline =
      toDay(block.delay_baseline_date as string | null) ||
      toDay(block.estimated_completion_date as string | null) ||
      bidFinish(myBid.start_date as string | null, myBid.duration_days as number | null) ||
      toDay(block.desired_completion_date as string | null);
    const delayDays = baseline ? Math.max(0, daysBetween(baseline, new_estimated_completion)) : 0;

    await execute(
      `UPDATE blocks SET estimated_completion_date = ?, delay_baseline_date = ?, pending_delay_days = ?, updated_at = datetime('now') WHERE id = ?`,
      [new_estimated_completion, baseline, delayDays, blockId]
    );

    const downstream = await downstreamBlockIds(blockId, projectId);
    const project = await queryOne("SELECT owner_id FROM projects WHERE id = ?", [projectId]);

    await notify(
      Number(project!.owner_id), "block_delayed", "Delay needs your decision",
      `"${block.title}" is now expected to finish ${new_estimated_completion}${delayDays ? ` (${delayDays} day${delayDays !== 1 ? "s" : ""} late)` : ""}. ` +
        (downstream.length
          ? `Accept the delay to shift ${downstream.length} downstream block${downstream.length !== 1 ? "s" : ""}, or reopen it for bids to stay on schedule.`
          : "Accept the delay or reopen it for bids."),
      projectId, blockId
    );

    if (downstream.length > 0) {
      const placeholders = downstream.map(() => "?").join(",");
      const affected = await query(
        `SELECT DISTINCT bi.trade_id, b.id as block_id, b.title as block_title
         FROM bids bi JOIN blocks b ON b.id = bi.block_id
         WHERE bi.block_id IN (${placeholders}) AND bi.status IN ('accepted', 'needs_confirmation', 'pending')`,
        downstream
      );
      for (const a of affected) {
        await notify(
          Number(a.trade_id), "delay_notification", "Upstream delay reported",
          `"${block.title}" has been delayed to ${new_estimated_completion}. The owner is deciding whether to shift the schedule for "${a.block_title}". Nothing changes until they do.`,
          projectId, Number(a.block_id)
        );
      }
    }
  } else if (new_estimated_completion) {
    await execute("UPDATE blocks SET estimated_completion_date = ?, updated_at = datetime('now') WHERE id = ?", [new_estimated_completion, blockId]);
  }

  if (status === "completed") {
    await execute("UPDATE blocks SET actual_completion_date = datetime('now'), updated_at = datetime('now') WHERE id = ?", [blockId]);

    const downstreamBlocks = await query(`
      SELECT bd.block_id
      FROM block_dependencies bd
      WHERE bd.depends_on_block_id = ?
    `, [blockId]);

    for (const downstream of downstreamBlocks) {
      const allDeps = await queryOne(`
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed
        FROM block_dependencies bd
        JOIN blocks b ON b.id = bd.depends_on_block_id
        WHERE bd.block_id = ?
      `, [downstream.block_id as number]) as { total: number; completed: number };

      if (allDeps.total === allDeps.completed) {
        const dsBlock = await queryOne("SELECT status FROM blocks WHERE id = ?", [downstream.block_id as number]) as { status: string };
        if (dsBlock.status === "pending") {
          await execute("UPDATE blocks SET status = 'open_for_bids', updated_at = datetime('now') WHERE id = ?", [downstream.block_id as number]);
        }
      }
    }
  }

  return NextResponse.json({ success: true });
}
