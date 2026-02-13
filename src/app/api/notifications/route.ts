import { NextRequest, NextResponse } from "next/server";
import { query, execute } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("user_id");

  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }

  const notifications = await query(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
    [Number(userId)]
  );

  return NextResponse.json(notifications);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, mark_all_read, user_id } = body;

  if (mark_all_read && user_id) {
    await execute("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [Number(user_id)]);
  } else if (id) {
    await execute("UPDATE notifications SET is_read = 1 WHERE id = ?", [Number(id)]);
  }

  return NextResponse.json({ success: true });
}
