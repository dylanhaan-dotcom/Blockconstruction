import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute } from "@/lib/db";
import { getViewer } from "@/lib/access";
import { bidFinish } from "@/lib/schedule";
import { reportDelay } from "@/lib/delays";

export const dynamic = "force-dynamic";

// A downstream trade who can't make the dates the owner shifted proposes their own.
// The bid keeps waiting on the owner, who accepts the new date (moving later blocks) or reopens bidding.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bid = await queryOne("SELECT * FROM bids WHERE id = ?", [Number(id)]);
  if (!bid) return NextResponse.json({ error: "Bid not found" }, { status: 404 });
  if (Number(bid.trade_id) !== viewer.id) {
    return NextResponse.json({ error: "Only the trade who submitted this bid can propose dates" }, { status: 403 });
  }
  if (bid.status !== "needs_confirmation") {
    return NextResponse.json({ error: "This bid has no schedule change to respond to" }, { status: 400 });
  }

  const { start_date, duration_days, reason } = await request.json();
  const duration = Number(duration_days);
  if (!start_date || !(duration > 0)) {
    return NextResponse.json({ error: "A start date and duration are required" }, { status: 400 });
  }

  // The finish the trade is being asked to make: their shifted bid dates, else the block's own dates
  const block = await queryOne("SELECT estimated_completion_date, desired_completion_date FROM blocks WHERE id = ?", [Number(bid.block_id)]);
  const currentFinish =
    bidFinish(bid.start_date as string | null, bid.duration_days as number | null) ||
    (block?.estimated_completion_date as string | null)?.slice(0, 10) ||
    (block?.desired_completion_date as string | null)?.slice(0, 10) ||
    null;
  const proposedFinish = bidFinish(start_date, duration)!;
  if (currentFinish && proposedFinish <= currentFinish) {
    return NextResponse.json(
      { error: `Those dates finish by ${currentFinish}, within the new schedule. Confirm the new dates instead.` },
      { status: 400 }
    );
  }

  await execute(
    "UPDATE bids SET start_date = ?, duration_days = ?, updated_at = datetime('now') WHERE id = ?",
    [start_date, duration, Number(id)]
  );
  const trade = await queryOne("SELECT name FROM users WHERE id = ?", [viewer.id]);
  await reportDelay({
    blockId: Number(bid.block_id),
    newFinish: proposedFinish,
    baseline: currentFinish,
    reason: reason || null,
    tradeName: String(trade?.name || "The trade"),
    kind: "cannot_make_dates",
  });

  const updated = await queryOne("SELECT * FROM bids WHERE id = ?", [Number(id)]);
  return NextResponse.json(updated);
}
