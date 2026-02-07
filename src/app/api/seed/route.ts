import { NextResponse } from "next/server";
import { seedDatabase } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    seedDatabase();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
