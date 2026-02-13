import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute } from "@/lib/db";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const project = await queryOne(`
    SELECT p.*, u.name as owner_name
    FROM projects p
    JOIN users u ON p.owner_id = u.id
    WHERE p.id = ?
  `, [Number(id)]);

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
  const body = await request.json();
  const { title, address, project_type, description, status, budget, allow_parallel_bidding, generate_share_token, open_all_bids } = body;

  if (title !== undefined) await execute("UPDATE projects SET title = ?, updated_at = datetime('now') WHERE id = ?", [title, Number(id)]);
  if (address !== undefined) await execute("UPDATE projects SET address = ?, updated_at = datetime('now') WHERE id = ?", [address, Number(id)]);
  if (project_type !== undefined) await execute("UPDATE projects SET project_type = ?, updated_at = datetime('now') WHERE id = ?", [project_type, Number(id)]);
  if (description !== undefined) await execute("UPDATE projects SET description = ?, updated_at = datetime('now') WHERE id = ?", [description, Number(id)]);
  if (status !== undefined) await execute("UPDATE projects SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, Number(id)]);
  if (budget !== undefined) await execute("UPDATE projects SET budget = ?, updated_at = datetime('now') WHERE id = ?", [budget, Number(id)]);
  if (allow_parallel_bidding !== undefined) await execute("UPDATE projects SET allow_parallel_bidding = ?, updated_at = datetime('now') WHERE id = ?", [allow_parallel_bidding ? 1 : 0, Number(id)]);

  if (generate_share_token) {
    const token = crypto.randomBytes(16).toString("hex");
    await execute("UPDATE projects SET share_token = ?, updated_at = datetime('now') WHERE id = ?", [token, Number(id)]);
  }

  if (open_all_bids) {
    await execute("UPDATE blocks SET status = 'open_for_bids', updated_at = datetime('now') WHERE project_id = ? AND status = 'pending'", [Number(id)]);
  }

  const project = await queryOne("SELECT * FROM projects WHERE id = ?", [Number(id)]);
  return NextResponse.json(project);
}
