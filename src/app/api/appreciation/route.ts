import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

function generateRedeemCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "BC-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const PARTNER_RESTAURANTS = [
  { name: "The Sawmill Grill", cuisine: "American", address: "123 Main St" },
  { name: "Blueprint Café", cuisine: "Coffee & Brunch", address: "456 Oak Ave" },
  { name: "Cornerstone Bistro", cuisine: "Italian", address: "789 Elm Blvd" },
  { name: "The Beam & Truss", cuisine: "Gastropub", address: "321 Pine St" },
  { name: "Level Line Sushi", cuisine: "Japanese", address: "654 Cedar Rd" },
];

export async function GET(request: NextRequest) {
  const db = getDb();
  const fromUserId = request.nextUrl.searchParams.get("from_user_id");
  const toUserId = request.nextUrl.searchParams.get("to_user_id");

  let query = `
    SELECT a.*,
      fu.name as from_name,
      tu.name as to_name,
      p.title as project_title,
      b.title as block_title
    FROM appreciations a
    JOIN users fu ON fu.id = a.from_user_id
    JOIN users tu ON tu.id = a.to_user_id
    LEFT JOIN projects p ON p.id = a.project_id
    LEFT JOIN blocks b ON b.id = a.block_id
  `;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (fromUserId) {
    conditions.push("a.from_user_id = ?");
    params.push(Number(fromUserId));
  }
  if (toUserId) {
    conditions.push("a.to_user_id = ?");
    params.push(Number(toUserId));
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY a.created_at DESC";

  const appreciations = db.prepare(query).all(...params);
  return NextResponse.json(appreciations);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { from_user_id, to_user_id, project_id, block_id, type, amount, message } = body;

  const redeemCode = generateRedeemCode();

  const result = db.prepare(`
    INSERT INTO appreciations (from_user_id, to_user_id, project_id, block_id, type, amount, message, redeem_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(from_user_id, to_user_id, project_id || null, block_id || null, type, amount, message || null, redeemCode);

  // Notify the trade
  const fromUser = db.prepare("SELECT name FROM users WHERE id = ?").get(from_user_id) as { name: string };

  const typeLabel = type === "coffee" ? "Coffee ($20)" : type === "lunch" ? "Lunch ($40)" : type === "dinner" ? "Dinner ($75)" : `$${amount} reward`;

  db.prepare(`
    INSERT INTO notifications (user_id, type, title, message, related_project_id, related_block_id)
    VALUES (?, 'appreciation', 'You received a reward!', ?, ?, ?)
  `).run(
    to_user_id,
    `${fromUser.name} sent you a ${typeLabel}!${message ? ` "${message}"` : ""} Use code ${redeemCode} at any partner restaurant.`,
    project_id || null,
    block_id || null
  );

  const appreciation = db.prepare("SELECT * FROM appreciations WHERE id = ?").get(result.lastInsertRowid) as Record<string, unknown>;
  return NextResponse.json({ ...appreciation, partner_restaurants: PARTNER_RESTAURANTS }, { status: 201 });
}
