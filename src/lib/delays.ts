import { query, execute } from "./db";
import { downstreamClosure } from "./schedule";

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
