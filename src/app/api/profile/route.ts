import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute } from "@/lib/db";
import { auth } from "@/lib/auth";
import { parseList } from "@/lib/trades";

export const dynamic = "force-dynamic";

const PROFILE_COLUMNS = "id, name, email, role, trade_type, secondary_trades, capabilities, license_info, insurance_info, rating, rating_count";

async function getViewerId() {
  const session = await auth();
  return Number((session?.user as Record<string, unknown> | undefined)?.id) || 0;
}

function toProfile(user: Record<string, unknown>) {
  return {
    ...user,
    secondary_trades: parseList(user.secondary_trades),
    capabilities: parseList(user.capabilities),
  };
}

function cleanList(value: unknown): string[] {
  const seen = new Set<string>();
  for (const item of parseList(value)) {
    const trimmed = item.trim();
    if (trimmed) seen.add(trimmed.slice(0, 80));
  }
  return Array.from(seen).slice(0, 30);
}

export async function GET() {
  const viewerId = await getViewerId();
  if (!viewerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await queryOne(`SELECT ${PROFILE_COLUMNS} FROM users WHERE id = ?`, [viewerId]);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(toProfile(user));
}

export async function PUT(request: NextRequest) {
  const viewerId = await getViewerId();
  if (!viewerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await queryOne("SELECT role FROM users WHERE id = ?", [viewerId]);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  if (user.role === "trade") {
    const tradeType = typeof body.trade_type === "string" ? body.trade_type.trim() : "";
    if (!tradeType) return NextResponse.json({ error: "Profession is required" }, { status: 400 });
    const secondary = cleanList(body.secondary_trades).filter((t) => t !== tradeType);

    await execute(
      `UPDATE users SET name = ?, trade_type = ?, secondary_trades = ?, capabilities = ?, license_info = ?, insurance_info = ? WHERE id = ?`,
      [
        name, tradeType, JSON.stringify(secondary), JSON.stringify(cleanList(body.capabilities)),
        body.license_info || null, body.insurance_info || null, viewerId,
      ]
    );
  } else {
    await execute("UPDATE users SET name = ? WHERE id = ?", [name, viewerId]);
  }

  const updated = await queryOne(`SELECT ${PROFILE_COLUMNS} FROM users WHERE id = ?`, [viewerId]);
  return NextResponse.json(toProfile(updated!));
}
