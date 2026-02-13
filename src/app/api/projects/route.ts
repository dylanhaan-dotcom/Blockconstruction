import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db";
import crypto from "crypto";

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

  let projects;
  if (ownerId) {
    projects = await query(`
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
    `, [Number(ownerId)]);
  } else {
    projects = await query(`
      SELECT p.*,
        u.name as owner_name,
        COUNT(DISTINCT b.id) as block_count,
        COUNT(DISTINCT CASE WHEN b.status = 'completed' THEN b.id END) as completed_blocks,
        COALESCE(SUM(CASE WHEN bi.status = 'accepted' THEN bi.price ELSE 0 END), 0) as total_awarded
      FROM projects p
      JOIN users u ON p.owner_id = u.id
      LEFT JOIN blocks b ON b.project_id = p.id
      LEFT JOIN bids bi ON bi.block_id = b.id
      GROUP BY p.id
      ORDER BY p.updated_at DESC
    `);
  }

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { owner_id, title, address, project_type, description, budget, allow_parallel_bidding } = body;

  const shareToken = crypto.randomBytes(16).toString("hex");

  const result = await execute(
    `INSERT INTO projects (owner_id, title, address, project_type, description, budget, allow_parallel_bidding, share_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [owner_id, title, address, project_type, description, budget || null, allow_parallel_bidding ? 1 : 0, shareToken]
  );

  const project = await queryOne("SELECT * FROM projects WHERE id = ?", [result.lastInsertRowid!]);
  return NextResponse.json(project, { status: 201 });
}
