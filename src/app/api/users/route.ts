import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const db = getDb();

  const role = request.nextUrl.searchParams.get("role");

  let users;
  if (role) {
    users = db.prepare("SELECT * FROM users WHERE role = ? ORDER BY name").all(role);
  } else {
    users = db.prepare("SELECT * FROM users ORDER BY role, name").all();
  }

  return NextResponse.json(users);
}
