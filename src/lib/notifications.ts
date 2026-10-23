import { queryOne, execute } from "./db";

export async function notifyOwnerOfRevision(blockId: number, tradeId: number) {
  const block = await queryOne(
    "SELECT b.title, b.project_id, p.owner_id FROM blocks b JOIN projects p ON p.id = b.project_id WHERE b.id = ?",
    [blockId]
  );
  const trade = await queryOne("SELECT name FROM users WHERE id = ?", [tradeId]);
  if (!block || !trade) return;

  await execute(`
    INSERT INTO notifications (user_id, type, title, message, related_project_id, related_block_id)
    VALUES (?, 'bid_revised', 'Bid Revised', ?, ?, ?)
  `, [
    block.owner_id as number,
    `${trade.name} has revised their bid for "${block.title}".`,
    block.project_id as number,
    blockId
  ]);
}
