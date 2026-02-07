import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const db = getDb();
  const userId = request.nextUrl.searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  const notifications = db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(Number(userId));

  return NextResponse.json(notifications);
}

export async function PUT(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { id, mark_all_read, user_id } = body;

  if (mark_all_read && user_id) {
    db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(Number(user_id));
  } else if (id) {
    db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(Number(id));
  }

  return NextResponse.json({ success: true });
}
