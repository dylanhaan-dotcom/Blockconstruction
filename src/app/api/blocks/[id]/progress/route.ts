import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { trade_id, status, notes, new_estimated_completion } = body;

  await execute(`
    INSERT INTO progress_updates (block_id, trade_id, status, notes, new_estimated_completion)
    VALUES (?, ?, ?, ?, ?)
  `, [Number(id), trade_id, status, notes, new_estimated_completion || null]);

  await execute("UPDATE blocks SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, Number(id)]);

  if (new_estimated_completion) {
    await execute("UPDATE blocks SET estimated_completion_date = ?, updated_at = datetime('now') WHERE id = ?", [new_estimated_completion, Number(id)]);
  }

  if (status === "completed") {
    await execute("UPDATE blocks SET actual_completion_date = datetime('now'), updated_at = datetime('now') WHERE id = ?", [Number(id)]);

    const downstreamBlocks = await query(`
      SELECT bd.block_id
      FROM block_dependencies bd
      WHERE bd.depends_on_block_id = ?
    `, [Number(id)]);

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

  if (status === "delayed") {
    const block = await queryOne("SELECT * FROM blocks WHERE id = ?", [Number(id)]) as { project_id: number; title: string };
    const project = await queryOne("SELECT owner_id FROM projects WHERE id = ?", [block.project_id]) as { owner_id: number };

    const downstreamAccepted = await query(`
      SELECT DISTINCT bi.id as bid_id, bi.trade_id, b.id as block_id, b.title as block_title
      FROM block_dependencies bd
      JOIN blocks b ON b.id = bd.block_id
      JOIN bids bi ON bi.block_id = b.id AND bi.status = 'accepted'
      WHERE bd.depends_on_block_id = ?
    `, [Number(id)]);

    for (const item of downstreamAccepted) {
      await execute("UPDATE bids SET status = 'needs_confirmation', delay_confirmed = 0, updated_at = datetime('now') WHERE id = ?", [item.bid_id as number]);

      await execute(`
        INSERT INTO notifications (user_id, type, title, message, related_project_id, related_block_id)
        VALUES (?, 'delay_confirmation_needed', 'Schedule Change - Confirmation Required', ?, ?, ?)
      `, [
        item.trade_id,
        `"${block.title}" has been delayed${new_estimated_completion ? ` to ${new_estimated_completion}` : ""}. Please confirm the new schedule or revise your bid for "${item.block_title}".`,
        block.project_id,
        item.block_id
      ]);
    }

    const downstreamPending = await query(`
      SELECT DISTINCT bi.trade_id, b.id as block_id, b.title as block_title
      FROM block_dependencies bd
      JOIN blocks b ON b.id = bd.block_id
      JOIN bids bi ON bi.block_id = b.id AND bi.status = 'pending'
      WHERE bd.depends_on_block_id = ?
    `, [Number(id)]);

    for (const trade of downstreamPending) {
      await execute(`
        INSERT INTO notifications (user_id, type, title, message, related_project_id, related_block_id)
        VALUES (?, 'delay_notification', 'Upstream Block Delayed', ?, ?, ?)
      `, [
        trade.trade_id,
        `"${block.title}" has been delayed${new_estimated_completion ? ` to ${new_estimated_completion}` : ""}. This may affect your block "${trade.block_title}". Consider updating your bid.`,
        block.project_id,
        trade.block_id
      ]);
    }

    // Notify project owner
    await execute(`
      INSERT INTO notifications (user_id, type, title, message, related_project_id, related_block_id)
      VALUES (?, 'block_delayed', 'Block Delayed', ?, ?, ?)
    `, [
      project.owner_id,
      `"${block.title}" has been delayed.${new_estimated_completion ? ` New estimated completion: ${new_estimated_completion}.` : ""} Downstream trades must confirm the new schedule.`,
      block.project_id,
      Number(id)
    ]);
  }

  return NextResponse.json({ success: true });
}
