import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const blockId = request.nextUrl.searchParams.get("block_id");
  const tradeId = request.nextUrl.searchParams.get("trade_id");
  const status = request.nextUrl.searchParams.get("status");

  let sql = `
    SELECT bi.*, u.name as trade_name, u.trade_type, u.rating as trade_rating, u.rating_count as trade_rating_count,
      b.title as block_title, p.title as project_title
    FROM bids bi
    JOIN users u ON u.id = bi.trade_id
    JOIN blocks b ON b.id = bi.block_id
    JOIN projects p ON p.id = b.project_id
  `;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (blockId) {
    conditions.push("bi.block_id = ?");
    params.push(Number(blockId));
  }
  if (tradeId) {
    conditions.push("bi.trade_id = ?");
    params.push(Number(tradeId));
  }
  if (status) {
    conditions.push("bi.status = ?");
    params.push(status);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  sql += " ORDER BY bi.created_at DESC";

  const bids = await query(sql, params);
  return NextResponse.json(bids);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { block_id, trade_id, price, start_date, duration_days, description, license_info, insurance_info, is_revision, original_bid_id, revision_reason } = body;

  const result = await execute(`
    INSERT INTO bids (block_id, trade_id, price, start_date, duration_days, description, license_info, insurance_info, is_revision, original_bid_id, revision_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    block_id, trade_id, price, start_date, duration_days, description,
    license_info, insurance_info, is_revision || 0, original_bid_id || null, revision_reason || null
  ]);

  const bid = await queryOne("SELECT * FROM bids WHERE id = ?", [result.lastInsertRowid!]);
  return NextResponse.json(bid, { status: 201 });
}
