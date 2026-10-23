import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db";
import { auth } from "@/lib/auth";
import { notifyOwnerOfRevision } from "@/lib/notifications";

export const dynamic = "force-dynamic";

async function getSessionUser() {
  const session = await auth();
  const user = session?.user as Record<string, unknown> | undefined;
  if (!user?.id) return null;
  return { id: Number(user.id), role: user.role as string };
}

export async function GET(request: NextRequest) {
  const viewer = await getSessionUser();
  if (!viewer) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  // Trades only see their own bids; owners only see bids on their own projects.
  if (viewer.role === "trade") {
    conditions.push("bi.trade_id = ?");
    params.push(viewer.id);
  } else {
    conditions.push("p.owner_id = ?");
    params.push(viewer.id);
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  sql += " ORDER BY bi.created_at DESC";

  const bids = await query(sql, params);
  return NextResponse.json(bids);
}

export async function POST(request: NextRequest) {
  const viewer = await getSessionUser();
  if (!viewer || viewer.role !== "trade") {
    return NextResponse.json({ error: "Only trades can submit bids" }, { status: 403 });
  }

  const body = await request.json();
  const { block_id, price, revision_reason } = body;
  const [start_date, duration_days, description, license_info, insurance_info] =
    [body.start_date, body.duration_days, body.description, body.license_info, body.insurance_info].map((v) => v ?? null);
  const trade_id = viewer.id;

  // A trade has at most one open bid per block: resubmitting revises it in place.
  const existing = await queryOne(
    "SELECT id FROM bids WHERE block_id = ? AND trade_id = ? AND status IN ('pending', 'needs_confirmation') ORDER BY created_at DESC LIMIT 1",
    [block_id, trade_id]
  );

  if (existing) {
    await execute(`
      UPDATE bids SET price = ?, start_date = ?, duration_days = ?, description = ?, license_info = ?, insurance_info = ?,
        is_revision = 1, revision_reason = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [
      price, start_date, duration_days, description, license_info, insurance_info,
      revision_reason || null, existing.id as number
    ]);
    await notifyOwnerOfRevision(block_id, trade_id);
    const bid = await queryOne("SELECT * FROM bids WHERE id = ?", [existing.id as number]);
    return NextResponse.json(bid);
  }

  const result = await execute(`
    INSERT INTO bids (block_id, trade_id, price, start_date, duration_days, description, license_info, insurance_info)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [block_id, trade_id, price, start_date, duration_days, description, license_info, insurance_info]);

  const bid = await queryOne("SELECT * FROM bids WHERE id = ?", [result.lastInsertRowid!]);
  return NextResponse.json(bid, { status: 201 });
}
