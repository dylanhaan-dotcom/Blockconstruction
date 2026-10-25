import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db";
import { auth } from "@/lib/auth";
import { bidFinish } from "@/lib/schedule";
import { requireProjectOwner } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("project_id");
  const status = request.nextUrl.searchParams.get("status");
  const tradeType = request.nextUrl.searchParams.get("trade_type");
  // Comma-separated list, e.g. a trade's primary and additional trades
  const tradeTypes = request.nextUrl.searchParams.get("trade_types");
  const available = request.nextUrl.searchParams.get("available");
  const shareToken = request.nextUrl.searchParams.get("share_token");

  // Awarded trade and price are only shown to the project owner or via the project's share link.
  const session = await auth();
  const viewerId = Number((session?.user as Record<string, unknown> | undefined)?.id) || 0;

  let sql = `
    SELECT b.*,
      p.title as project_title,
      p.address as project_address,
      COUNT(DISTINCT bi.id) as bid_count,
      (SELECT u.name FROM bids bi2 JOIN users u ON u.id = bi2.trade_id WHERE bi2.block_id = b.id AND bi2.status IN ('accepted', 'needs_confirmation') LIMIT 1) as awarded_trade,
      (SELECT bi2.price FROM bids bi2 WHERE bi2.block_id = b.id AND bi2.status IN ('accepted', 'needs_confirmation') LIMIT 1) as awarded_price,
      (p.owner_id = ? OR (p.share_token IS NOT NULL AND p.share_token = ?)) as can_see_award,
      (SELECT bi3.id FROM bids bi3 WHERE bi3.block_id = b.id AND bi3.trade_id = ? ORDER BY bi3.created_at DESC LIMIT 1) as my_bid_id,
      (SELECT bi3.status FROM bids bi3 WHERE bi3.block_id = b.id AND bi3.trade_id = ? ORDER BY bi3.created_at DESC LIMIT 1) as my_bid_status,
      (SELECT bi3.price FROM bids bi3 WHERE bi3.block_id = b.id AND bi3.trade_id = ? ORDER BY bi3.created_at DESC LIMIT 1) as my_bid_price,
      (SELECT a.start_date FROM bids a WHERE a.block_id = b.id AND a.status IN ('accepted', 'needs_confirmation') LIMIT 1) as scheduled_start,
      (SELECT a.duration_days FROM bids a WHERE a.block_id = b.id AND a.status IN ('accepted', 'needs_confirmation') LIMIT 1) as scheduled_duration
    FROM blocks b
    JOIN projects p ON b.project_id = p.id
    LEFT JOIN bids bi ON bi.block_id = b.id
  `;

  const conditions: string[] = [];
  const params: (string | number | null)[] = [viewerId, shareToken, viewerId, viewerId, viewerId];

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
  if (tradeTypes) {
    const list = tradeTypes.split(",").map((t) => t.trim()).filter(Boolean);
    if (list.length > 0) {
      conditions.push(`b.trade_type IN (${list.map(() => "?").join(",")})`);
      params.push(...list);
    }
  }
  if (available === "true") {
    conditions.push("b.status = 'open_for_bids'");
  }

  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }

  sql += " GROUP BY b.id ORDER BY b.sort_order ASC, b.id ASC";

  const blocks = await query(sql, params);

  for (const block of blocks) {
    if (!block.can_see_award) {
      block.awarded_trade = null;
      block.awarded_price = null;
    }
    delete block.can_see_award;
    // Accepted bid dates (never price or trade) so a project's whole schedule can be shown
    block.scheduled_finish = bidFinish(block.scheduled_start, block.scheduled_duration);
    delete block.scheduled_duration;

    const deps = await query(
      "SELECT depends_on_block_id FROM block_dependencies WHERE block_id = ?",
      [block.id as number]
    );
    block.dependencies = deps.map((d) => d.depends_on_block_id);

    const depNames = await query(
      "SELECT b.title FROM block_dependencies bd JOIN blocks b ON b.id = bd.depends_on_block_id WHERE bd.block_id = ?",
      [block.id as number]
    );
    block.dependency_names = depNames.map((d) => d.title);

    if (deps.length > 0) {
      const depIds = deps.map((d) => d.depends_on_block_id as number);
      const placeholders = depIds.map(() => "?").join(",");
      const depStatuses = await queryOne(
        `SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
         FROM blocks WHERE id IN (${placeholders})`,
        depIds
      );
      block.depends_on_completed = depStatuses!.total === depStatuses!.completed;
    } else {
      block.depends_on_completed = true;
    }
  }

  return NextResponse.json(blocks);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { project_id, title, description, trade_type, desired_start_date, desired_completion_date, special_requirements, sort_order, dependencies } = body;

  const owner = await requireProjectOwner(Number(project_id));
  if (owner instanceof NextResponse) return owner;

  // Dependencies must be blocks of the same project
  const depIds: number[] = Array.isArray(dependencies) ? dependencies.map(Number) : [];
  for (const depId of depIds) {
    const dep = await queryOne("SELECT id FROM blocks WHERE id = ? AND project_id = ?", [depId, Number(project_id)]);
    if (!dep) return NextResponse.json({ error: "Dependencies must be blocks in this project" }, { status: 400 });
  }

  const result = await execute(
    `INSERT INTO blocks (project_id, title, description, trade_type, desired_start_date, desired_completion_date, special_requirements, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [project_id, title, description ?? null, trade_type ?? null, desired_start_date ?? null, desired_completion_date ?? null, special_requirements ?? null, sort_order || 0]
  );

  const blockId = result.lastInsertRowid!;

  if (depIds.length > 0) {
    for (const depId of depIds) {
      await execute(
        "INSERT INTO block_dependencies (block_id, depends_on_block_id) VALUES (?, ?)",
        [blockId, depId]
      );
    }
  }

  const block = await queryOne("SELECT * FROM blocks WHERE id = ?", [blockId]);
  return NextResponse.json(block, { status: 201 });
}
