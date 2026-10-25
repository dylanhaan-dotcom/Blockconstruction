import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db";
import crypto from "crypto";
import { getViewer } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ownerId = request.nextUrl.searchParams.get("owner_id");
  const shareToken = request.nextUrl.searchParams.get("share_token");

  if (shareToken) {
    const project = await queryOne(`
      SELECT p.*,
        u.name as owner_name,
        COUNT(DISTINCT b.id) as block_count,
        COUNT(DISTINCT CASE WHEN b.status = 'completed' THEN b.id END) as completed_blocks,
        COALESCE(SUM(CASE WHEN bi.status = 'accepted' THEN bi.price ELSE 0 END), 0) as total_awarded
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      LEFT JOIN blocks b ON b.project_id = p.id
      LEFT JOIN bids bi ON bi.block_id = b.id
      WHERE p.share_token = ?
      GROUP BY p.id
    `, [shareToken]);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json([project]);
  }

  // Outside the public share link, an owner can only list their own projects
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ownerId && Number(ownerId) !== viewer.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const projects = await query(`
    SELECT p.*,
      u.name as owner_name,
      COUNT(DISTINCT b.id) as block_count,
      COUNT(DISTINCT CASE WHEN b.status = 'completed' THEN b.id END) as completed_blocks,
      COALESCE(SUM(CASE WHEN bi.status = 'accepted' THEN bi.price ELSE 0 END), 0) as total_awarded
    FROM projects p
    JOIN users u ON p.owner_id = u.id
    LEFT JOIN blocks b ON b.project_id = p.id
    LEFT JOIN bids bi ON bi.block_id = b.id
    WHERE p.owner_id = ?
    GROUP BY p.id
    ORDER BY p.updated_at DESC
    `, [viewer.id]);

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "project_owner") {
    return NextResponse.json({ error: "Only project owners can create projects" }, { status: 403 });
  }

  const body = await request.json();
  const { title, address, project_type, description, budget, allow_parallel_bidding } = body;
  const owner_id = viewer.id;

  const shareToken = crypto.randomBytes(16).toString("hex");

  const result = await execute(
    `INSERT INTO projects (owner_id, title, address, project_type, description, budget, allow_parallel_bidding, share_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [owner_id, title ?? null, address ?? null, project_type ?? null, description ?? null, budget || null, allow_parallel_bidding ? 1 : 0, shareToken]
  );

  const project = await queryOne("SELECT * FROM projects WHERE id = ?", [result.lastInsertRowid!]);
  return NextResponse.json(project, { status: 201 });
}
