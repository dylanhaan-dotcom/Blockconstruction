import { NextResponse } from "next/server";
import { seedDatabase } from "@/lib/seed";
import { ensureDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const db = await ensureDb();
    await seedDatabase(db);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
