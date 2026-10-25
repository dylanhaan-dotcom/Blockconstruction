import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db";
import { getViewer } from "@/lib/access";
import { bidFinish, toDay } from "@/lib/schedule";
import { reportDelay } from "@/lib/delays";

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
    const trade = await queryOne("SELECT name FROM users WHERE id = ?", [viewer.id]);
    await reportDelay({
      blockId,
      newFinish: new_estimated_completion,
      baseline:
        toDay(block.estimated_completion_date as string | null) ||
        bidFinish(myBid.start_date as string | null, myBid.duration_days as number | null) ||
        toDay(block.desired_completion_date as string | null),
      reason: notes || null,
      tradeName: String(trade?.name || "The trade"),
      kind: "delay",
    });
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
