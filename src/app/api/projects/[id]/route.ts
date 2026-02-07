import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

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
  const { title, address, project_type, description, status, budget } = body;

  db.prepare(`
    UPDATE projects
    SET title = COALESCE(?, title),
        address = COALESCE(?, address),
        project_type = COALESCE(?, project_type),
        description = COALESCE(?, description),
        status = COALESCE(?, status),
        budget = COALESCE(?, budget),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(title, address, project_type, description, status, budget, Number(id));

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(Number(id));
  return NextResponse.json(project);
}
