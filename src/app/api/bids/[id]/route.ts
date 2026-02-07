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
  const { status } = body;

  const bid = db.prepare("SELECT * FROM bids WHERE id = ?").get(Number(id)) as {
    id: number; block_id: number; trade_id: number; price: number;
  } | undefined;

  if (!bid) {
    return NextResponse.json({ error: "Bid not found" }, { status: 404 });
  }

  db.prepare("UPDATE bids SET status = ? WHERE id = ?").run(status, Number(id));

  if (status === "accepted") {
    // Reject all other pending bids for this block
    db.prepare(
      "UPDATE bids SET status = 'rejected' WHERE block_id = ? AND id != ? AND status = 'pending'"
    ).run(bid.block_id, Number(id));

    // Update block status to awarded
    db.prepare("UPDATE blocks SET status = 'awarded', updated_at = datetime('now') WHERE id = ?").run(bid.block_id);

    // Notify winning trade
    const block = db.prepare("SELECT b.*, p.title as project_title FROM blocks b JOIN projects p ON p.id = b.project_id WHERE b.id = ?").get(bid.block_id) as { title: string; project_title: string; project_id: number };

    db.prepare(`
      INSERT INTO notifications (user_id, type, title, message, related_project_id, related_block_id)
      VALUES (?, 'bid_accepted', 'Bid Accepted!', ?, ?, ?)
    `).run(
      bid.trade_id,
      `Your bid of $${bid.price.toLocaleString()} for "${block.title}" on ${block.project_title} has been accepted!`,
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

  const updated = db.prepare("SELECT * FROM bids WHERE id = ?").get(Number(id));
  return NextResponse.json(updated);
}
