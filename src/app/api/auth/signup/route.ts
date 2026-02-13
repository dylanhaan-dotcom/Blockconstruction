import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { queryOne, execute } from "@/lib/db";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, email, password, role, trade_type } = body;

  if (!name || !email || !password || !role) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  if (!["project_owner", "trade"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  if (role === "trade" && !trade_type) {
    return NextResponse.json({ error: "Trade type is required for trade accounts" }, { status: 400 });
  }

  const existing = await queryOne("SELECT id FROM users WHERE email = ?", [email]);
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const result = await execute(
    "INSERT INTO users (name, email, password_hash, role, trade_type) VALUES (?, ?, ?, ?, ?)",
    [name, email, password_hash, role, trade_type || null]
  );

  return NextResponse.json({ id: Number(result.lastInsertRowid), name, email, role }, { status: 201 });
}
