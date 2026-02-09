import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const project = db.prepare(`
    SELECT p.*, u.name as owner_name
    FROM projects p
    JOIN users u ON p.owner_id = u.id
    WHERE p.id = ?
  `).get(Number(id));

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();
  const body = await request.json();
  const { title, address, project_type, description, status, budget, allow_parallel_bidding, generate_share_token, open_all_bids } = body;

  if (title !== undefined) db.prepare("UPDATE projects SET title = ?, updated_at = datetime('now') WHERE id = ?").run(title, Number(id));
  if (address !== undefined) db.prepare("UPDATE projects SET address = ?, updated_at = datetime('now') WHERE id = ?").run(address, Number(id));
  if (project_type !== undefined) db.prepare("UPDATE projects SET project_type = ?, updated_at = datetime('now') WHERE id = ?").run(project_type, Number(id));
  if (description !== undefined) db.prepare("UPDATE projects SET description = ?, updated_at = datetime('now') WHERE id = ?").run(description, Number(id));
  if (status !== undefined) db.prepare("UPDATE projects SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, Number(id));
  if (budget !== undefined) db.prepare("UPDATE projects SET budget = ?, updated_at = datetime('now') WHERE id = ?").run(budget, Number(id));
  if (allow_parallel_bidding !== undefined) db.prepare("UPDATE projects SET allow_parallel_bidding = ?, updated_at = datetime('now') WHERE id = ?").run(allow_parallel_bidding ? 1 : 0, Number(id));

  if (generate_share_token) {
    const token = crypto.randomBytes(16).toString("hex");
    db.prepare("UPDATE projects SET share_token = ?, updated_at = datetime('now') WHERE id = ?").run(token, Number(id));
  }

  // Open all pending blocks for bids at once
  if (open_all_bids) {
    db.prepare("UPDATE blocks SET status = 'open_for_bids', updated_at = datetime('now') WHERE project_id = ? AND status = 'pending'").run(Number(id));
  }

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(Number(id));
  return NextResponse.json(project);
}
