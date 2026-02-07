import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const block = db.prepare(`
    SELECT b.*, p.title as project_title, p.address as project_address, p.owner_id
    FROM blocks b
    JOIN projects p ON b.project_id = p.id
    WHERE b.id = ?
  `).get(Number(id)) as Record<string, unknown> | undefined;

  if (!block) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  // Get dependencies
  const deps = db.prepare(
    "SELECT depends_on_block_id FROM block_dependencies WHERE block_id = ?"
  ).all(Number(id)) as { depends_on_block_id: number }[];
  block.dependencies = deps.map((d) => d.depends_on_block_id);

  const depNames = db.prepare(
    "SELECT b.id, b.title, b.status FROM block_dependencies bd JOIN blocks b ON b.id = bd.depends_on_block_id WHERE bd.block_id = ?"
  ).all(Number(id));
  block.dependency_blocks = depNames;

  // Get bids
  const bids = db.prepare(`
    SELECT bi.*, u.name as trade_name, u.trade_type, u.rating as trade_rating, u.rating_count as trade_rating_count
    FROM bids bi
    JOIN users u ON u.id = bi.trade_id
    WHERE bi.block_id = ?
    ORDER BY bi.created_at DESC
  `).all(Number(id));
  block.bids = bids;

  // Get progress updates
  const updates = db.prepare(`
    SELECT pu.*, u.name as trade_name
    FROM progress_updates pu
    JOIN users u ON u.id = pu.trade_id
    WHERE pu.block_id = ?
    ORDER BY pu.created_at DESC
  `).all(Number(id));
  block.progress_updates = updates;

  // Check if all deps are completed
  if (deps.length > 0) {
    const depStatuses = db.prepare(
      `SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
       FROM blocks WHERE id IN (${deps.map(() => "?").join(",")})`
    ).get(...deps.map((d) => d.depends_on_block_id)) as { total: number; completed: number };
    block.depends_on_completed = depStatuses.total === depStatuses.completed;
  } else {
    block.depends_on_completed = true;
  }

  // Get downstream blocks (blocks that depend on this one)
  const downstream = db.prepare(`
    SELECT b.id, b.title, b.status
    FROM block_dependencies bd
    JOIN blocks b ON b.id = bd.block_id
    WHERE bd.depends_on_block_id = ?
  `).all(Number(id));
  block.downstream_blocks = downstream;

  return NextResponse.json(block);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();
  const { status, estimated_completion_date, title, description, trade_type, desired_completion_date, special_requirements } = body;

  if (status) {
    db.prepare("UPDATE blocks SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, Number(id));
  }
  if (estimated_completion_date !== undefined) {
    db.prepare("UPDATE blocks SET estimated_completion_date = ?, updated_at = datetime('now') WHERE id = ?").run(estimated_completion_date, Number(id));
  }
  if (status === "completed") {
    db.prepare("UPDATE blocks SET actual_completion_date = datetime('now'), updated_at = datetime('now') WHERE id = ?").run(Number(id));
  }
  if (title) {
    db.prepare("UPDATE blocks SET title = ?, updated_at = datetime('now') WHERE id = ?").run(title, Number(id));
  }
  if (description !== undefined) {
    db.prepare("UPDATE blocks SET description = ?, updated_at = datetime('now') WHERE id = ?").run(description, Number(id));
  }
  if (trade_type !== undefined) {
    db.prepare("UPDATE blocks SET trade_type = ?, updated_at = datetime('now') WHERE id = ?").run(trade_type, Number(id));
  }
  if (desired_completion_date !== undefined) {
    db.prepare("UPDATE blocks SET desired_completion_date = ?, updated_at = datetime('now') WHERE id = ?").run(desired_completion_date, Number(id));
  }
  if (special_requirements !== undefined) {
    db.prepare("UPDATE blocks SET special_requirements = ?, updated_at = datetime('now') WHERE id = ?").run(special_requirements, Number(id));
  }

  // Handle delay notifications
  if (status === "delayed" || (estimated_completion_date && status !== "completed")) {
    const block = db.prepare("SELECT * FROM blocks WHERE id = ?").get(Number(id)) as { project_id: number; title: string };

    // Find downstream blocks and their awarded trades
    const downstreamTrades = db.prepare(`
      SELECT DISTINCT bi.trade_id, b.id as block_id, b.title as block_title, u.name as trade_name
      FROM block_dependencies bd
      JOIN blocks b ON b.id = bd.block_id
      JOIN bids bi ON bi.block_id = b.id AND bi.status = 'accepted'
      JOIN users u ON u.id = bi.trade_id
      WHERE bd.depends_on_block_id = ?
    `).all(Number(id)) as { trade_id: number; block_id: number; block_title: string; trade_name: string }[];

    for (const trade of downstreamTrades) {
      db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, related_project_id, related_block_id)
        VALUES (?, 'delay_notification', 'Upstream Block Delayed',
          ?, ?, ?)
      `).run(
        trade.trade_id,
        `The block "${block.title}" has been delayed. This affects your block "${trade.block_title}". You may want to submit a revised bid.`,
        block.project_id,
        trade.block_id
      );
    }

    // Also notify the project owner
    const project = db.prepare("SELECT owner_id FROM projects WHERE id = ?").get(block.project_id) as { owner_id: number };
    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, related_project_id, related_block_id)
      VALUES (?, 'block_delayed', 'Block Delayed',
        ?, ?, ?)
    `).run(
      project.owner_id,
      `"${block.title}" has been delayed.${estimated_completion_date ? ` New estimated completion: ${estimated_completion_date}.` : ""}`,
      block.project_id,
      Number(id)
    );
  }

  const updated = db.prepare("SELECT * FROM blocks WHERE id = ?").get(Number(id));
  return NextResponse.json(updated);
}
