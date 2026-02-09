import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();
  const { trade_id, status, notes, new_estimated_completion } = body;

  // Insert progress update
  db.prepare(`
    INSERT INTO progress_updates (block_id, trade_id, status, notes, new_estimated_completion)
    VALUES (?, ?, ?, ?, ?)
  `).run(Number(id), trade_id, status, notes, new_estimated_completion || null);

  // Update block status
  db.prepare("UPDATE blocks SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, Number(id));

  if (new_estimated_completion) {
    db.prepare("UPDATE blocks SET estimated_completion_date = ?, updated_at = datetime('now') WHERE id = ?").run(new_estimated_completion, Number(id));
  }

  if (status === "completed") {
    db.prepare("UPDATE blocks SET actual_completion_date = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(Number(id));

    // Check if any downstream blocks can now move to open_for_bids
    const downstreamBlocks = db.prepare(`
      SELECT bd.block_id
      FROM block_dependencies bd
      WHERE bd.depends_on_block_id = ?
    `).all(Number(id)) as { block_id: number }[];

    for (const downstream of downstreamBlocks) {
      const allDeps = db.prepare(`
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN b.status = 'completed' THEN 1 END) as completed
        FROM block_dependencies bd
        JOIN blocks b ON b.id = bd.depends_on_block_id
        WHERE bd.block_id = ?
      `).get(downstream.block_id) as { total: number; completed: number };

      if (allDeps.total === allDeps.completed) {
        const dsBlock = db.prepare("SELECT status FROM blocks WHERE id = ?").get(downstream.block_id) as { status: string };
        if (dsBlock.status === "pending") {
          db.prepare("UPDATE blocks SET status = 'open_for_bids', updated_at = datetime('now') WHERE id = ?").run(downstream.block_id);
        }
      }
    }
  }

  // Handle delay - notify downstream trades and set their bids to needs_confirmation
  if (status === "delayed") {
    const block = db.prepare("SELECT * FROM blocks WHERE id = ?").get(Number(id)) as { project_id: number; title: string };
    const project = db.prepare("SELECT owner_id FROM projects WHERE id = ?").get(block.project_id) as { owner_id: number };

    // Find downstream blocks with accepted bids - set those bids to needs_confirmation
    const downstreamAccepted = db.prepare(`
      SELECT DISTINCT bi.id as bid_id, bi.trade_id, b.id as block_id, b.title as block_title
      FROM block_dependencies bd
      JOIN blocks b ON b.id = bd.block_id
      JOIN bids bi ON bi.block_id = b.id AND bi.status = 'accepted'
      WHERE bd.depends_on_block_id = ?
    `).all(Number(id)) as { bid_id: number; trade_id: number; block_id: number; block_title: string }[];

    for (const item of downstreamAccepted) {
      // Set bid to needs_confirmation
      db.prepare("UPDATE bids SET status = 'needs_confirmation', delay_confirmed = 0, updated_at = datetime('now') WHERE id = ?").run(item.bid_id);

      db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, related_project_id, related_block_id)
        VALUES (?, 'delay_confirmation_needed', 'Schedule Change - Confirmation Required',
          ?, ?, ?)
      `).run(
        item.trade_id,
        `"${block.title}" has been delayed${new_estimated_completion ? ` to ${new_estimated_completion}` : ""}. Please confirm the new schedule or revise your bid for "${item.block_title}".`,
        block.project_id,
        item.block_id
      );
    }

    // Also notify trades with pending bids on downstream blocks
    const downstreamPending = db.prepare(`
      SELECT DISTINCT bi.trade_id, b.id as block_id, b.title as block_title
      FROM block_dependencies bd
      JOIN blocks b ON b.id = bd.block_id
      JOIN bids bi ON bi.block_id = b.id AND bi.status = 'pending'
      WHERE bd.depends_on_block_id = ?
    `).all(Number(id)) as { trade_id: number; block_id: number; block_title: string }[];

    for (const trade of downstreamPending) {
      db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, related_project_id, related_block_id)
        VALUES (?, 'delay_notification', 'Upstream Block Delayed',
          ?, ?, ?)
      `).run(
        trade.trade_id,
        `"${block.title}" has been delayed${new_estimated_completion ? ` to ${new_estimated_completion}` : ""}. This may affect your block "${trade.block_title}". Consider updating your bid.`,
        block.project_id,
        trade.block_id
      );
    }

    // Notify homeowner
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, related_project_id, related_block_id)
      VALUES (?, 'block_delayed', 'Block Delayed',
        ?, ?, ?)
    `).run(
      project.owner_id,
      `"${block.title}" has been delayed.${new_estimated_completion ? ` New estimated completion: ${new_estimated_completion}.` : ""} Downstream trades must confirm the new schedule.`,
      block.project_id,
      Number(id)
    );
  }

  return NextResponse.json({ success: true });
}
