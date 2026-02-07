import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const db = getDb();

  const projectId = request.nextUrl.searchParams.get("project_id");
  const status = request.nextUrl.searchParams.get("status");
  const tradeType = request.nextUrl.searchParams.get("trade_type");
  const available = request.nextUrl.searchParams.get("available");

  let query = `
    SELECT b.*,
      p.title as project_title,
      p.address as project_address,
      COUNT(DISTINCT bi.id) as bid_count,
      (SELECT u.name FROM bids bi2 JOIN users u ON u.id = bi2.trade_id WHERE bi2.block_id = b.id AND bi2.status = 'accepted' LIMIT 1) as awarded_trade,
      (SELECT bi2.price FROM bids bi2 WHERE bi2.block_id = b.id AND bi2.status = 'accepted' LIMIT 1) as awarded_price
    FROM blocks b
    JOIN projects p ON b.project_id = p.id
    LEFT JOIN bids bi ON bi.block_id = b.id
  `;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (projectId) {
    conditions.push("b.project_id = ?");
    params.push(Number(projectId));
  }

  if (status) {
    conditions.push("b.status = ?");
    params.push(status);
  }

  if (tradeType) {
    conditions.push("b.trade_type = ?");
    params.push(tradeType);
  }

  if (available === "true") {
    conditions.push("b.status = 'open_for_bids'");
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " GROUP BY b.id ORDER BY b.sort_order ASC, b.id ASC";

  const blocks = db.prepare(query).all(...params) as Record<string, unknown>[];

  // Attach dependencies for each block
  const depStmt = db.prepare(
    "SELECT depends_on_block_id FROM block_dependencies WHERE block_id = ?"
  );
  const depNameStmt = db.prepare(
    "SELECT b.title FROM block_dependencies bd JOIN blocks b ON b.id = bd.depends_on_block_id WHERE bd.block_id = ?"
  );

  for (const block of blocks) {
    const deps = depStmt.all(block.id as number) as { depends_on_block_id: number }[];
    block.dependencies = deps.map((d) => d.depends_on_block_id);

    const depNames = depNameStmt.all(block.id as number) as { title: string }[];
    block.dependency_names = depNames.map((d) => d.title);

    // Check if all dependencies are completed
    if (deps.length > 0) {
      const depStatuses = db.prepare(
        `SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
         FROM blocks WHERE id IN (${deps.map(() => "?").join(",")})`
      ).get(...deps.map((d) => d.depends_on_block_id)) as { total: number; completed: number };
      block.depends_on_completed = depStatuses.total === depStatuses.completed;
    } else {
      block.depends_on_completed = true;
    }
  }

  return NextResponse.json(blocks);
}

export async function POST(request: NextRequest) {
  const db = getDb();
  const body = await request.json();
  const { project_id, title, description, trade_type, desired_completion_date, special_requirements, sort_order, dependencies } = body;

  const result = db.prepare(
    `INSERT INTO blocks (project_id, title, description, trade_type, desired_completion_date, special_requirements, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(project_id, title, description, trade_type, desired_completion_date, special_requirements, sort_order || 0);

  const blockId = result.lastInsertRowid;

  // Add dependencies
  if (dependencies && dependencies.length > 0) {
    const insertDep = db.prepare(
      "INSERT INTO block_dependencies (block_id, depends_on_block_id) VALUES (?, ?)"
    );
    for (const depId of dependencies) {
      insertDep.run(blockId, depId);
    }
  }

  const block = db.prepare("SELECT * FROM blocks WHERE id = ?").get(blockId);
  return NextResponse.json(block, { status: 201 });
}
