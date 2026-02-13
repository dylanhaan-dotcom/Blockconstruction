import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const block = await queryOne(`
    SELECT b.*, p.title as project_title, p.address as project_address, p.owner_id
    FROM blocks b
    JOIN projects p ON b.project_id = p.id
    WHERE b.id = ?
  `, [Number(id)]);

  if (!block) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  const deps = await query(
    "SELECT depends_on_block_id FROM block_dependencies WHERE block_id = ?",
    [Number(id)]
  );
  block.dependencies = deps.map((d) => d.depends_on_block_id);

  block.dependency_blocks = await query(
    "SELECT b.id, b.title, b.status FROM block_dependencies bd JOIN blocks b ON b.id = bd.depends_on_block_id WHERE bd.block_id = ?",
    [Number(id)]
  );

  block.bids = await query(`
    SELECT bi.*, u.name as trade_name, u.trade_type, u.rating as trade_rating, u.rating_count as trade_rating_count
    FROM bids bi
    JOIN users u ON u.id = bi.trade_id
    WHERE bi.block_id = ?
    ORDER BY bi.created_at DESC
  `, [Number(id)]);

  block.progress_updates = await query(`
    SELECT pu.*, u.name as trade_name
    FROM progress_updates pu
    JOIN users u ON u.id = pu.trade_id
    WHERE pu.block_id = ?
    ORDER BY pu.created_at DESC
  `, [Number(id)]);

  if (deps.length > 0) {
    const depIds = deps.map((d) => d.depends_on_block_id as number);
    const placeholders = depIds.map(() => "?").join(",");
    const depStatuses = await queryOne(
      `SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
       FROM blocks WHERE id IN (${placeholders})`,
      depIds
    );
    block.depends_on_completed = depStatuses!.total === depStatuses!.completed;
  } else {
    block.depends_on_completed = true;
  }

  block.downstream_blocks = await query(`
    SELECT b.id, b.title, b.status
    FROM block_dependencies bd
    JOIN blocks b ON b.id = bd.block_id
    WHERE bd.depends_on_block_id = ?
  `, [Number(id)]);

  return NextResponse.json(block);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { status, estimated_completion_date, title, description, trade_type, desired_completion_date, special_requirements, reopen_bids } = body;

  if (status) {
    await execute("UPDATE blocks SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, Number(id)]);
  }
  if (estimated_completion_date !== undefined) {
    await execute("UPDATE blocks SET estimated_completion_date = ?, updated_at = datetime('now') WHERE id = ?", [estimated_completion_date, Number(id)]);
  }
  if (status === "completed") {
    await execute("UPDATE blocks SET actual_completion_date = datetime('now'), updated_at = datetime('now') WHERE id = ?", [Number(id)]);
  }
  if (title) {
    await execute("UPDATE blocks SET title = ?, updated_at = datetime('now') WHERE id = ?", [title, Number(id)]);
  }
  if (description !== undefined) {
    await execute("UPDATE blocks SET description = ?, updated_at = datetime('now') WHERE id = ?", [description, Number(id)]);
  }
  if (trade_type !== undefined) {
    await execute("UPDATE blocks SET trade_type = ?, updated_at = datetime('now') WHERE id = ?", [trade_type, Number(id)]);
  }
  if (desired_completion_date !== undefined) {
    await execute("UPDATE blocks SET desired_completion_date = ?, updated_at = datetime('now') WHERE id = ?", [desired_completion_date, Number(id)]);
  }
  if (special_requirements !== undefined) {
    await execute("UPDATE blocks SET special_requirements = ?, updated_at = datetime('now') WHERE id = ?", [special_requirements, Number(id)]);
  }

  if (reopen_bids) {
    await execute("UPDATE blocks SET status = 'open_for_bids', updated_at = datetime('now') WHERE id = ?", [Number(id)]);
    await execute("UPDATE bids SET status = 'pending', updated_at = datetime('now') WHERE block_id = ? AND status = 'accepted'", [Number(id)]);

    const affectedTrades = await query(
      "SELECT DISTINCT bi.trade_id, u.name as trade_name FROM bids bi JOIN users u ON u.id = bi.trade_id WHERE bi.block_id = ? AND bi.status = 'pending'",
      [Number(id)]
    );

    const blockInfo = await queryOne("SELECT b.title, b.project_id FROM blocks b WHERE b.id = ?", [Number(id)]) as { title: string; project_id: number };

    for (const trade of affectedTrades) {
      await execute(`
        INSERT INTO notifications (user_id, type, title, message, related_project_id, related_block_id)
        VALUES (?, 'bid_reopened', 'Block Updated & Reopened', ?, ?, ?)
      `, [
        trade.trade_id,
        `The block "${blockInfo.title}" has been updated and reopened for bidding. Your bid is now pending.`,
        blockInfo.project_id,
        Number(id)
      ]);
    }
  }

  if (status === "delayed" || (estimated_completion_date && status !== "completed")) {
    const block = await queryOne("SELECT * FROM blocks WHERE id = ?", [Number(id)]) as { project_id: number; title: string };

    const downstreamTrades = await query(`
      SELECT DISTINCT bi.trade_id, b.id as block_id, b.title as block_title, u.name as trade_name
      FROM block_dependencies bd
      JOIN blocks b ON b.id = bd.block_id
      JOIN bids bi ON bi.block_id = b.id AND bi.status = 'accepted'
      JOIN users u ON u.id = bi.trade_id
      WHERE bd.depends_on_block_id = ?
    `, [Number(id)]);

    for (const trade of downstreamTrades) {
      await execute(`
        INSERT INTO notifications (user_id, type, title, message, related_project_id, related_block_id)
        VALUES (?, 'delay_notification', 'Upstream Block Delayed', ?, ?, ?)
      `, [
        trade.trade_id,
        `The block "${block.title}" has been delayed. This affects your block "${trade.block_title}". You may want to submit a revised bid.`,
        block.project_id,
        trade.block_id
      ]);
    }

    const project = await queryOne("SELECT owner_id FROM projects WHERE id = ?", [block.project_id]) as { owner_id: number };
    await execute(`
      INSERT INTO notifications (user_id, type, title, message, related_project_id, related_block_id)
      VALUES (?, 'block_delayed', 'Block Delayed', ?, ?, ?)
    `, [
      project.owner_id,
      `"${block.title}" has been delayed.${estimated_completion_date ? ` New estimated completion: ${estimated_completion_date}.` : ""}`,
      block.project_id,
      Number(id)
    ]);
  }

  const updated = await queryOne("SELECT * FROM blocks WHERE id = ?", [Number(id)]);
  return NextResponse.json(updated);
}
