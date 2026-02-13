import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const role = request.nextUrl.searchParams.get("role");

  let users;
  if (role) {
    users = await query("SELECT * FROM users WHERE role = ? ORDER BY name", [role]);
  } else {
    users = await query("SELECT * FROM users ORDER BY role, name");
  }

  return NextResponse.json(users);
}
