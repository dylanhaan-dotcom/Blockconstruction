import { query, queryOne, execute } from "./db";
import { daysBetween, downstreamClosure } from "./schedule";

// Downstream block ids for a block, following dependencies through the whole project
export async function downstreamBlockIds(blockId: number, projectId: number): Promise<number[]> {
  const deps = await query(
    `SELECT bd.block_id, bd.depends_on_block_id FROM block_dependencies bd
     JOIN blocks b ON b.id = bd.block_id WHERE b.project_id = ?`,
    [projectId]
  );
  const byBlock = new Map<number, number[]>();
  for (const d of deps) {
    const id = Number(d.block_id);
    byBlock.set(id, [...(byBlock.get(id) || []), Number(d.depends_on_block_id)]);
  }
  return downstreamClosure(blockId, Array.from(byBlock, ([id, dependencies]) => ({ id, dependencies })));
}

export async function notify(userId: number, type: string, title: string, message: string, projectId: number, blockId: number) {
  await execute(
    `INSERT INTO notifications (user_id, type, title, message, related_project_id, related_block_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, type, title, message, projectId, blockId]
  );
}

// Records a schedule slip on a block for the owner to decide on: a trade reporting a delay on their
// work, or a downstream trade who can't make dates the owner shifted. The days lost are measured
// against the finish date in place before the first undecided slip.
export async function reportDelay(opts: {
  blockId: number;
  newFinish: string;
  baseline: string | null;
  reason: string | null;
  tradeName: string;
  kind: "delay" | "cannot_make_dates";
}) {
  const block = await queryOne("SELECT * FROM blocks WHERE id = ?", [opts.blockId]);
  if (!block) return;
  const projectId = Number(block.project_id);
  const baseline = (block.delay_baseline_date as string | null) || opts.baseline;
  const delayDays = baseline ? Math.max(0, daysBetween(baseline.slice(0, 10), opts.newFinish)) : 0;

  await execute(
    `UPDATE blocks SET estimated_completion_date = ?, delay_baseline_date = ?, pending_delay_days = ?,
       pending_delay_reason = ?, updated_at = datetime('now') WHERE id = ?`,
    [opts.newFinish, baseline, delayDays, opts.reason || null, opts.blockId]
  );

  const downstream = await downstreamBlockIds(opts.blockId, projectId);
  const project = await queryOne("SELECT owner_id FROM projects WHERE id = ?", [projectId]);
  const late = delayDays ? ` (${delayDays} day${delayDays !== 1 ? "s" : ""} late)` : "";
  const what = opts.kind === "delay"
    ? `${opts.tradeName} confirmed a delay on "${block.title}": now finishing ${opts.newFinish}${late}.`
    : `${opts.tradeName} can't make the new dates for "${block.title}" and proposes finishing ${opts.newFinish}${late}.`;
  await notify(
    Number(project!.owner_id), "block_delayed", "Schedule decision needed",
    `${what} Accept the new date${downstream.length ? ` (it moves ${downstream.length} downstream block${downstream.length !== 1 ? "s" : ""})` : ""} or reopen the block for bids.`,
    projectId, opts.blockId
  );

  if (downstream.length > 0) {
    const placeholders = downstream.map(() => "?").join(",");
    const affected = await query(
      `SELECT DISTINCT bi.trade_id, b.id as block_id, b.title as block_title
       FROM bids bi JOIN blocks b ON b.id = bi.block_id
       WHERE bi.block_id IN (${placeholders}) AND bi.status IN ('accepted', 'needs_confirmation', 'pending')`,
      downstream
    );
    for (const a of affected) {
      await notify(
        Number(a.trade_id), "delay_notification", "Upstream schedule change",
        `"${block.title}" may now finish ${opts.newFinish}. The owner is deciding whether to move the schedule for "${a.block_title}". Nothing changes until they do.`,
        projectId, Number(a.block_id)
      );
    }
  }
  return { delayDays, downstream };
}
