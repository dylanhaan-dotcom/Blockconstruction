import { Client } from "@libsql/client";
import bcrypt from "bcryptjs";

function generateRedeemCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "BC-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function seedDatabase(db: Client) {
  const result = await db.execute("SELECT COUNT(*) as count FROM users");
  if (Number(result.rows[0][0]) > 0) return;

  // Hash a default password for demo accounts
  const hash = await bcrypt.hash("password123", 10);

  const u = "INSERT INTO users (name, email, password_hash, role, trade_type, license_info, insurance_info, rating, rating_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";

  await db.batch(
    [
      { sql: u, args: ["Sarah Mitchell", "sarah@example.com", hash, "project_owner", null, null, null, 0, 0] },
      { sql: u, args: ["David Chen", "david@example.com", hash, "project_owner", null, null, null, 0, 0] },
      { sql: u, args: ["Mike's Electric", "mike@electric.com", hash, "trade", "Electrician", "EL-2024-4821", "State Farm #EL-991234", 4.8, 23] },
      { sql: u, args: ["Rivera Plumbing", "rivera@plumbing.com", hash, "trade", "Plumber", "PL-2024-1192", "Allstate #PL-445566", 4.5, 17] },
      { sql: u, args: ["Oakwood Carpentry", "oak@carpentry.com", hash, "trade", "Carpenter", "CA-2024-7733", "Liberty Mutual #CA-223344", 4.9, 31] },
      { sql: u, args: ["ProTile Solutions", "info@protile.com", hash, "trade", "Tile Installer", "TI-2024-5544", "GEICO #TI-112233", 4.2, 12] },
      { sql: u, args: ["Summit Painting Co", "hello@summit.com", hash, "trade", "Painter", "PA-2024-8899", "Progressive #PA-667788", 4.6, 19] },
    ],
    "write"
  );

  const p = "INSERT INTO projects (owner_id, title, address, project_type, description, status, budget, allow_parallel_bidding, share_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
  await db.batch(
    [
      { sql: p, args: [1, "Kitchen Remodel", "742 Evergreen Terrace, Springfield", "Kitchen Remodel", "Full kitchen renovation including new cabinets, countertops, electrical upgrades, plumbing updates, tile backsplash, and painting. Budget is $45,000.", "in_progress", 45000, 0, "abc123kitchenremodel"] },
      { sql: p, args: [2, "Bathroom Addition", "123 Oak Street, Portland", "Bathroom Addition", "Adding a full bathroom to the basement including shower, toilet, vanity, and tile work.", "planning", 25000, 1, null] },
    ],
    "write"
  );

  const b = "INSERT INTO blocks (id, project_id, title, description, trade_type, status, desired_completion_date, estimated_completion_date, actual_completion_date, special_requirements, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  await db.batch(
    [
      { sql: b, args: [1, 1, "Kitchen Demolition", "Remove existing cabinets, countertops, backsplash, and flooring. Dispose of debris.", "Carpenter", "completed", "2026-01-20", "2026-01-20", "2026-01-19", "Protect adjacent rooms with plastic sheeting. Salvage cabinet hardware if possible.", 1] },
      { sql: b, args: [2, 1, "Electrical Rough-In", "Run new circuits for appliances: dedicated 20A for dishwasher, 50A for range, 20A for microwave. Add under-cabinet lighting circuits. Install new panel breakers.", "Electrician", "completed", "2026-01-28", "2026-01-28", "2026-01-27", "Must comply with NEC 2023 code. Permit required.", 2] },
      { sql: b, args: [3, 1, "Plumbing Rough-In", "Relocate sink drain 18 inches to the left. Install new supply lines for dishwasher. Add gas line for range. Pressure test all connections.", "Plumber", "completed", "2026-02-03", "2026-02-03", "2026-02-02", "Gas line must be tested by city inspector.", 3] },
      { sql: b, args: [4, 1, "Cabinet Installation", "Install new Shaker-style cabinets per design plan. Wall cabinets and base cabinets. Include lazy susan corner unit and pull-out trash cabinet.", "Carpenter", "in_progress", "2026-02-14", "2026-02-16", null, "Level all cabinets to within 1/16 inch. Use provided hardware.", 4] },
      { sql: b, args: [5, 1, "Countertop Fabrication & Install", "Template, fabricate, and install quartz countertops. Include undermount sink cutout. Edge profile: eased edge.", "Carpenter", "awarded", "2026-02-24", "2026-02-26", null, "Material: Caesarstone Calacatta Nuvo. Template after cabinets are complete.", 5] },
      { sql: b, args: [6, 1, "Electrical Finish Work", "Install outlets, switches, and under-cabinet LED lighting. Connect dishwasher and range circuits. Install pendant lights over island.", "Electrician", "open_for_bids", "2026-02-28", null, null, "Use Decora-style outlets and switches in white. Pendant light fixtures provided by project owner.", 6] },
      { sql: b, args: [7, 1, "Plumbing Fixture Installation", "Install undermount sink, faucet, garbage disposal, and dishwasher connections. Test all for leaks.", "Plumber", "open_for_bids", "2026-03-03", null, null, "Sink: Kraus KHU100-30. Faucet: Delta Trinsic. Disposal: InSinkErator Evolution.", 7] },
      { sql: b, args: [8, 1, "Tile Backsplash Installation", "Install subway tile backsplash from countertop to bottom of wall cabinets. Include outlet cutouts. Grout color: warm gray.", "Tile Installer", "open_for_bids", "2026-03-07", null, null, "Tile: 3x6 white ceramic subway. Pattern: standard brick. Use 1/16 inch spacers.", 8] },
      { sql: b, args: [9, 1, "Kitchen Painting", "Paint walls, ceiling, and trim. Two coats on walls, one on ceiling. Touch up any cabinet paint if needed.", "Painter", "pending", "2026-03-12", null, null, "Wall color: Benjamin Moore Simply White OC-117. Ceiling: flat white. Trim: semi-gloss white.", 9] },
      { sql: b, args: [10, 1, "Final Inspection & Punch List", "Walk-through with project owner. Address any punch list items. Final cleaning. Arrange city final inspection for electrical and plumbing permits.", "Carpenter", "pending", "2026-03-17", null, null, "Compile all warranty documents and manuals for project owner.", 10] },
      { sql: b, args: [11, 2, "Bathroom Framing", "Frame walls for new bathroom space including door opening.", "Carpenter", "pending", "2026-03-15", null, null, "Must be load-bearing wall compatible.", 1] },
      { sql: b, args: [12, 2, "Bathroom Plumbing Rough-In", "Run drain, supply, and vent lines for toilet, shower, and vanity.", "Plumber", "pending", "2026-03-25", null, null, "Requires permit. Must tie into existing main stack.", 2] },
      { sql: b, args: [13, 2, "Bathroom Electrical", "Run circuits for lights, fan, GFCI outlets, and heated floor.", "Electrician", "pending", "2026-03-25", null, null, "All outlets must be GFCI protected.", 3] },
      { sql: b, args: [14, 2, "Tile & Shower Installation", "Install shower pan, tile shower walls and floor, install vanity tile.", "Tile Installer", "pending", "2026-04-10", null, null, "Waterproofing membrane required (Kerdi or equivalent).", 4] },
      { sql: b, args: [15, 2, "Bathroom Fixtures & Finish", "Install toilet, vanity, mirror, fixtures, and accessories.", "Plumber", "pending", "2026-04-17", null, null, "Fixtures TBD by project owner.", 5] },
    ],
    "write"
  );

  const d = "INSERT INTO block_dependencies (block_id, depends_on_block_id) VALUES (?, ?)";
  await db.batch(
    [
      { sql: d, args: [2, 1] }, { sql: d, args: [3, 1] },
      { sql: d, args: [4, 2] }, { sql: d, args: [4, 3] },
      { sql: d, args: [5, 4] }, { sql: d, args: [6, 4] },
      { sql: d, args: [7, 5] }, { sql: d, args: [8, 5] },
      { sql: d, args: [9, 6] }, { sql: d, args: [9, 8] },
      { sql: d, args: [10, 7] }, { sql: d, args: [10, 9] },
      { sql: d, args: [12, 11] }, { sql: d, args: [13, 11] },
      { sql: d, args: [14, 12] }, { sql: d, args: [14, 13] },
      { sql: d, args: [15, 14] },
    ],
    "write"
  );

  const bi = "INSERT INTO bids (block_id, trade_id, price, start_date, duration_days, description, license_info, insurance_info, status, is_revision, original_bid_id, revision_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
  await db.batch(
    [
      { sql: bi, args: [1, 5, 2800, "2026-01-14", 5, "Full demo with debris hauling included. We'll protect all adjacent rooms.", "CA-2024-7733", "Liberty Mutual #CA-223344", "accepted", 0, null, null] },
      { sql: bi, args: [2, 3, 3200, "2026-01-22", 5, "Complete electrical rough-in per NEC 2023. Includes permit pull.", "EL-2024-4821", "State Farm #EL-991234", "accepted", 0, null, null] },
      { sql: bi, args: [3, 4, 2900, "2026-01-29", 4, "All plumbing rough-in including gas line. City inspection included.", "PL-2024-1192", "Allstate #PL-445566", "accepted", 0, null, null] },
      { sql: bi, args: [4, 5, 4500, "2026-02-05", 8, "Professional cabinet installation with laser leveling.", "CA-2024-7733", "Liberty Mutual #CA-223344", "accepted", 0, null, null] },
      { sql: bi, args: [5, 5, 5200, "2026-02-17", 7, "Full template, fabrication, and installation of quartz countertops.", "CA-2024-7733", "Liberty Mutual #CA-223344", "accepted", 0, null, null] },
      { sql: bi, args: [6, 3, 2100, "2026-02-20", 4, "Complete electrical finish including pendant installation and under-cabinet LEDs.", "EL-2024-4821", "State Farm #EL-991234", "pending", 0, null, null] },
      { sql: bi, args: [7, 4, 1800, "2026-02-28", 3, "Install all fixtures, connect dishwasher, full leak test.", "PL-2024-1192", "Allstate #PL-445566", "pending", 0, null, null] },
      { sql: bi, args: [8, 6, 2400, "2026-02-28", 5, "Professional subway tile installation with precise grout lines.", "TI-2024-5544", "GEICO #TI-112233", "pending", 0, null, null] },
    ],
    "write"
  );

  const pu = "INSERT INTO progress_updates (block_id, trade_id, status, notes, new_estimated_completion, created_at) VALUES (?, ?, ?, ?, ?, ?)";
  await db.batch(
    [
      { sql: pu, args: [1, 5, "in_progress", "Started demolition. Removed upper cabinets.", null, "2026-01-14 09:00:00"] },
      { sql: pu, args: [1, 5, "in_progress", "All cabinets and countertops removed. Starting flooring removal.", null, "2026-01-16 14:00:00"] },
      { sql: pu, args: [1, 5, "completed", "Demolition complete. Site cleaned and ready for next phase.", null, "2026-01-19 16:00:00"] },
      { sql: pu, args: [2, 3, "in_progress", "Started running new circuits from panel.", null, "2026-01-22 08:00:00"] },
      { sql: pu, args: [2, 3, "completed", "All circuits run and tested. Passed rough-in inspection.", null, "2026-01-27 15:00:00"] },
      { sql: pu, args: [3, 4, "in_progress", "Relocating sink drain.", null, "2026-01-29 08:00:00"] },
      { sql: pu, args: [3, 4, "completed", "All plumbing rough-in complete. Gas line tested and approved.", null, "2026-02-02 14:00:00"] },
      { sql: pu, args: [4, 5, "in_progress", "Started wall cabinet installation. First row complete.", null, "2026-02-05 09:00:00"] },
      { sql: pu, args: [4, 5, "in_progress", "Wall cabinets done. Base cabinets 50% complete. Slight delay due to corner unit fitment issue.", "2026-02-16", "2026-02-10 16:00:00"] },
    ],
    "write"
  );

  const n = "INSERT INTO notifications (user_id, type, title, message, related_project_id, related_block_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
  await db.batch(
    [
      { sql: n, args: [3, "bid_accepted", "Bid Accepted!", "Your bid for 'Electrical Rough-In' on Kitchen Remodel has been accepted.", 1, 2, 1, "2026-01-20 10:00:00"] },
      { sql: n, args: [4, "bid_accepted", "Bid Accepted!", "Your bid for 'Plumbing Rough-In' on Kitchen Remodel has been accepted.", 1, 3, 1, "2026-01-20 10:05:00"] },
      { sql: n, args: [5, "bid_accepted", "Bid Accepted!", "Your bid for 'Kitchen Demolition' on Kitchen Remodel has been accepted.", 1, 1, 1, "2026-01-13 10:00:00"] },
      { sql: n, args: [1, "block_delayed", "Block Delayed", "Cabinet Installation has been delayed. New estimated completion: Feb 16, 2026.", 1, 4, 0, "2026-02-10 16:05:00"] },
    ],
    "write"
  );

  const a = "INSERT INTO appreciations (from_user_id, to_user_id, project_id, block_id, type, amount, message, redeem_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
  await db.batch(
    [
      { sql: a, args: [1, 5, 1, 1, "lunch", 40, "Great job on the demo! Clean and fast work. Enjoy lunch on me!", generateRedeemCode()] },
      { sql: a, args: [1, 3, 1, 2, "coffee", 20, "Thanks for getting the electrical done ahead of schedule!", generateRedeemCode()] },
    ],
    "write"
  );

  console.log("Database seeded successfully!");
}
