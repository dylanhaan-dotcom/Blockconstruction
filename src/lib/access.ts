import { NextResponse } from "next/server";
import { auth } from "./auth";
import { queryOne } from "./db";

export interface Viewer {
  id: number;
  role: string;
}

export async function getViewer(): Promise<Viewer | null> {
  const session = await auth();
  const user = session?.user as Record<string, unknown> | undefined;
  const id = Number(user?.id) || 0;
  return id ? { id, role: String(user?.role || "") } : null;
}

// Resolves to the viewer when they own the project, or to an error response to return as-is.
export async function requireProjectOwner(projectId: number): Promise<Viewer | NextResponse> {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const project = await queryOne("SELECT owner_id FROM projects WHERE id = ?", [projectId]);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (Number(project.owner_id) !== viewer.id) {
    return NextResponse.json({ error: "Only the project owner can do this" }, { status: 403 });
  }
  return viewer;
}

export async function requireBlockOwner(blockId: number): Promise<Viewer | NextResponse> {
  const block = await queryOne("SELECT project_id FROM blocks WHERE id = ?", [blockId]);
  if (!block) return NextResponse.json({ error: "Block not found" }, { status: 404 });
  return requireProjectOwner(Number(block.project_id));
}
