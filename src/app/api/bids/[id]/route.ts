import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();
  const { status, price, start_date, duration_days, description, license_info, insurance_info, delay_confirmed } = body;

  const bid = db.prepare("SELECT * FROM bids WHERE id = ?").get(Number(id)) as {
    id: number; block_id: number; trade_id: number; price: number; status: string;
  } | undefined;

  if (!bid) {
    return NextResponse.json({ error: "Bid not found" }, { status: 404 });
  }

  // Allow editing pending or needs_confirmation bids
  if (bid.status === "pending" || bid.status === "needs_confirmation") {
    if (price !== undefined) db.prepare("UPDATE bids SET price = ?, updated_at = datetime('now') WHERE id = ?").run(price, Number(id));
    if (start_date !== undefined) db.prepare("UPDATE bids SET start_date = ?, updated_at = datetime('now') WHERE id = ?").run(start_date, Number(id));
    if (duration_days !== undefined) db.prepare("UPDATE bids SET duration_days = ?, updated_at = datetime('now') WHERE id = ?").run(duration_days, Number(id));
    if (description !== undefined) db.prepare("UPDATE bids SET description = ?, updated_at = datetime('now') WHERE id = ?").run(description, Number(id));
    if (license_info !== undefined) db.prepare("UPDATE bids SET license_info = ?, updated_at = datetime('now') WHERE id = ?").run(license_info, Number(id));
    if (insurance_info !== undefined) db.prepare("UPDATE bids SET insurance_info = ?, updated_at = datetime('now') WHERE id = ?").run(insurance_info, Number(id));
  }

  // Handle delay confirmation from trade
  if (delay_confirmed !== undefined) {
    db.prepare("UPDATE bids SET delay_confirmed = ?, status = 'pending', updated_at = datetime('now') WHERE id = ?").run(delay_confirmed ? 1 : 0, Number(id));

    // Notify homeowner
    const block = db.prepare("SELECT b.*, p.title as project_title, p.owner_id FROM blocks b JOIN projects p ON p.id = b.project_id WHERE b.id = ?").get(bid.block_id) as { title: string; project_title: string; project_id: number; owner_id: number };
    const trade = db.prepare("SELECT name FROM users WHERE id = ?").get(bid.trade_id) as { name: string };

    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, related_project_id, related_block_id)
      VALUES (?, 'delay_confirmed', 'Schedule Confirmed', ?, ?, ?)
    `).run(
      block.owner_id,
      `${trade.name} has confirmed the updated schedule for "${block.title}".`,
      block.project_id,
      bid.block_id
    );

    const updated = db.prepare("SELECT * FROM bids WHERE id = ?").get(Number(id));
    return NextResponse.json(updated);
  }

  if (status) {
    db.prepare("UPDATE bids SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, Number(id));
  }

  if (status === "accepted") {
    // Reject all other pending/needs_confirmation bids for this block
    db.prepare(
      "UPDATE bids SET status = 'rejected' WHERE block_id = ? AND id != ? AND status IN ('pending', 'needs_confirmation')"
    ).run(bid.block_id, Number(id));

    // Update block status to awarded
    db.prepare("UPDATE blocks SET status = 'awarded', updated_at = datetime('now') WHERE id = ?").run(bid.block_id);

    // Notify winning trade
    const block = db.prepare("SELECT b.*, p.title as project_title FROM blocks b JOIN projects p ON p.id = b.project_id WHERE b.id = ?").get(bid.block_id) as { title: string; project_title: string; project_id: number };
    const bidPrice = price !== undefined ? price : bid.price;

    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, related_project_id, related_block_id)
      VALUES (?, 'bid_accepted', 'Bid Accepted!', ?, ?, ?)
    `).run(
      bid.trade_id,
      `Your bid of $${bidPrice.toLocaleString()} for "${block.title}" on ${block.project_title} has been accepted!`,
      block.project_id,
      bid.block_id
    );

    // Notify rejected trades
    const rejectedBids = db.prepare(
      "SELECT DISTINCT trade_id FROM bids WHERE block_id = ? AND status = 'rejected' AND trade_id != ?"
    ).all(bid.block_id, bid.trade_id) as { trade_id: number }[];

    for (const rejected of rejectedBids) {
      db.prepare(`
        INSERT INTO notifications (user_id, type, title, message, related_project_id, related_block_id)
        VALUES (?, 'bid_rejected', 'Bid Not Selected', ?, ?, ?)
      `).run(
        rejected.trade_id,
        `Another bid was selected for "${block.title}" on ${block.project_title}. Thank you for bidding!`,
        block.project_id,
        bid.block_id
      );
    }
  }

  // Handle reopening: owner puts bid back to pending and reopens block
  if (status === "pending" && bid.status === "accepted") {
    // Prevent reopening completed blocks
    const blockCheck = db.prepare("SELECT status FROM blocks WHERE id = ?").get(bid.block_id) as { status: string };
    if (blockCheck.status === "completed") {
      return NextResponse.json({ error: "Cannot reopen bidding on a completed block" }, { status: 400 });
    }

    db.prepare("UPDATE blocks SET status = 'open_for_bids', updated_at = datetime('now') WHERE id = ?").run(bid.block_id);

    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, related_project_id, related_block_id)
      VALUES (?, 'bid_reopened', 'Block Reopened', ?, (SELECT project_id FROM blocks WHERE id = ?), ?)
    `).run(
      bid.trade_id,
      `The block has been reopened for bidding. Your bid is now pending again.`,
      bid.block_id,
      bid.block_id
    );
  }

  const updated = db.prepare("SELECT * FROM bids WHERE id = ?").get(Number(id));
  return NextResponse.json(updated);
}
