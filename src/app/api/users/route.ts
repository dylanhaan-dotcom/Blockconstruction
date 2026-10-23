import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const role = request.nextUrl.searchParams.get("role");

  // Never return password hashes or contact details.
  const columns = "id, name, role, trade_type, secondary_trades, capabilities, rating, rating_count, created_at";
  let users;
  if (role) {
    users = await query(`SELECT ${columns} FROM users WHERE role = ? ORDER BY name`, [role]);
  } else {
    users = await query(`SELECT ${columns} FROM users ORDER BY role, name`);
  }

  return NextResponse.json(users);
}
