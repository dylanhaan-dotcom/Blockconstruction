import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute } from "@/lib/db";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Only these are shown in the browser; anything else (HTML, SVG, ...) is downloaded so it can't run as part of the site.
const INLINE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf"]);

async function getViewerId() {
  const session = await auth();
  return Number((session?.user as Record<string, unknown> | undefined)?.id) || 0;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getViewerId())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const attachment = await queryOne("SELECT filename, content_type, data FROM attachments WHERE id = ?", [Number(id)]);
  if (!attachment) return NextResponse.json({ error: "File not found" }, { status: 404 });

  const contentType = String(attachment.content_type);
  const inline = INLINE_TYPES.has(contentType);
  const filename = String(attachment.filename);
  return new NextResponse(new Uint8Array(attachment.data as ArrayBuffer), {
    headers: {
      "Content-Type": inline ? contentType : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewerId = await getViewerId();
  if (!viewerId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const attachment = await queryOne(
    "SELECT a.id, p.owner_id FROM attachments a JOIN projects p ON p.id = a.project_id WHERE a.id = ?",
    [Number(id)]
  );
  if (!attachment) return NextResponse.json({ error: "File not found" }, { status: 404 });
  if (Number(attachment.owner_id) !== viewerId) {
    return NextResponse.json({ error: "Only the project owner can remove files" }, { status: 403 });
  }

  await execute("DELETE FROM attachments WHERE id = ?", [Number(id)]);
  return NextResponse.json({ ok: true });
}
