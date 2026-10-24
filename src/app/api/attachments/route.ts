import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db";
import { auth } from "@/lib/auth";
import { MAX_ATTACHMENT_BYTES } from "@/lib/attachments";

export const dynamic = "force-dynamic";

async function getViewerId() {
  const session = await auth();
  return Number((session?.user as Record<string, unknown> | undefined)?.id) || 0;
}

export async function GET(request: NextRequest) {
  if (!(await getViewerId())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const projectId = Number(request.nextUrl.searchParams.get("project_id"));
  if (!projectId) return NextResponse.json({ error: "project_id is required" }, { status: 400 });

  const attachments = await query(`
    SELECT a.id, a.project_id, a.block_id, a.filename, a.content_type, a.size, a.created_at, b.title as block_title
    FROM attachments a
    LEFT JOIN blocks b ON b.id = a.block_id
    WHERE a.project_id = ?
    ORDER BY a.created_at DESC
  `, [projectId]);
  return NextResponse.json(attachments);
}

export async function POST(request: NextRequest) {
  const viewerId = await getViewerId();
  if (!viewerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const projectId = Number(form.get("project_id"));
  const blockId = form.get("block_id") ? Number(form.get("block_id")) : null;

  if (!(file instanceof File) || !projectId) {
    return NextResponse.json({ error: "A file and project_id are required" }, { status: 400 });
  }
  if (file.size === 0) return NextResponse.json({ error: "The file is empty" }, { status: 400 });
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json({ error: "Files can be up to 4 MB" }, { status: 413 });
  }

  const project = await queryOne("SELECT owner_id FROM projects WHERE id = ?", [projectId]);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  if (Number(project.owner_id) !== viewerId) {
    return NextResponse.json({ error: "Only the project owner can add files" }, { status: 403 });
  }
  if (blockId) {
    const block = await queryOne("SELECT id FROM blocks WHERE id = ? AND project_id = ?", [blockId, projectId]);
    if (!block) return NextResponse.json({ error: "Block not found in this project" }, { status: 404 });
  }

  const filename = (file.name || "file").replace(/[\r\n"]/g, "").slice(0, 200);
  const result = await execute(
    `INSERT INTO attachments (project_id, block_id, uploaded_by, filename, content_type, size, data)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [projectId, blockId, viewerId, filename, file.type || "application/octet-stream", file.size, new Uint8Array(await file.arrayBuffer())]
  );

  const attachment = await queryOne(
    "SELECT id, project_id, block_id, filename, content_type, size, created_at FROM attachments WHERE id = ?",
    [result.lastInsertRowid!]
  );
  return NextResponse.json(attachment, { status: 201 });
}
