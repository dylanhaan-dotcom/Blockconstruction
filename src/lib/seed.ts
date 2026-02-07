import { getDb } from "./db";

function generateRedeemCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "BC-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function seedDatabase() {
  const db = getDb();

  // Check if data already exists
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (userCount.count > 0) {
    return;
  }

  const insertUser = db.prepare(
    `INSERT INTO users (name, email, role, trade_type, license_info, insurance_info, rating, rating_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  // Homeowners
  insertUser.run("Sarah Mitchell", "sarah@example.com", "homeowner", null, null, null, 0, 0);
  insertUser.run("David Chen", "david@example.com", "homeowner", null, null, null, 0, 0);

  // Trades
  insertUser.run("Mike's Electric", "mike@electric.com", "trade", "Electrician", "EL-2024-4821", "State Farm #EL-991234", 4.8, 23);
  insertUser.run("Rivera Plumbing", "rivera@plumbing.com", "trade", "Plumber", "PL-2024-1192", "Allstate #PL-445566", 4.5, 17);
  insertUser.run("Oakwood Carpentry", "oak@carpentry.com", "trade", "Carpenter", "CA-2024-7733", "Liberty Mutual #CA-223344", 4.9, 31);
  insertUser.run("ProTile Solutions", "info@protile.com", "trade", "Tile Installer", "TI-2024-5544", "GEICO #TI-112233", 4.2, 12);
  insertUser.run("Summit Painting Co", "hello@summit.com", "trade", "Painter", "PA-2024-8899", "Progressive #PA-667788", 4.6, 19);

  // Kitchen Remodel project (Sarah's project - in progress with various block states)
  const insertProject = db.prepare(
    `INSERT INTO projects (owner_id, title, address, project_type, description, status, budget) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  insertProject.run(
    1,
    "Kitchen Remodel",
    "742 Evergreen Terrace, Springfield",
    "Kitchen Remodel",
    "Full kitchen renovation including new cabinets, countertops, electrical upgrades, plumbing updates, tile backsplash, and painting. Budget is $45,000.",
    "in_progress",
    45000
  );

  // Blocks for the Kitchen Remodel
  const insertBlock = db.prepare(
    `INSERT INTO blocks (id, project_id, title, description, trade_type, status, desired_completion_date, estimated_completion_date, actual_completion_date, special_requirements, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  // Block 1: Demo (completed)
  insertBlock.run(1, 1, "Kitchen Demolition", "Remove existing cabinets, countertops, backsplash, and flooring. Dispose of debris.", "Carpenter", "completed", "2026-01-20", "2026-01-20", "2026-01-19", "Protect adjacent rooms with plastic sheeting. Salvage cabinet hardware if possible.", 1);

  // Block 2: Electrical Rough-In (completed)
  insertBlock.run(2, 1, "Electrical Rough-In", "Run new circuits for appliances: dedicated 20A for dishwasher, 50A for range, 20A for microwave. Add under-cabinet lighting circuits. Install new panel breakers.", "Electrician", "completed", "2026-01-28", "2026-01-28", "2026-01-27", "Must comply with NEC 2023 code. Permit required.", 2);

  // Block 3: Plumbing Rough-In (completed)
  insertBlock.run(3, 1, "Plumbing Rough-In", "Relocate sink drain 18 inches to the left. Install new supply lines for dishwasher. Add gas line for range. Pressure test all connections.", "Plumber", "completed", "2026-02-03", "2026-02-03", "2026-02-02", "Gas line must be tested by city inspector.", 3);

  // Block 4: Cabinet Installation (in_progress)
  insertBlock.run(4, 1, "Cabinet Installation", "Install new Shaker-style cabinets per design plan. Wall cabinets and base cabinets. Include lazy susan corner unit and pull-out trash cabinet.", "Carpenter", "in_progress", "2026-02-14", "2026-02-16", null, "Level all cabinets to within 1/16 inch. Use provided hardware.", 4);

  // Block 5: Countertop Installation (awarded - depends on cabinets)
  insertBlock.run(5, 1, "Countertop Fabrication & Install", "Template, fabricate, and install quartz countertops. Include undermount sink cutout. Edge profile: eased edge.", "Carpenter", "awarded", "2026-02-24", "2026-02-26", null, "Material: Caesarstone Calacatta Nuvo. Template after cabinets are complete.", 5);

  // Block 6: Electrical Finish (open_for_bids - depends on cabinets)
  insertBlock.run(6, 1, "Electrical Finish Work", "Install outlets, switches, and under-cabinet LED lighting. Connect dishwasher and range circuits. Install pendant lights over island.", "Electrician", "open_for_bids", "2026-02-28", null, null, "Use Decora-style outlets and switches in white. Pendant light fixtures provided by homeowner.", 6);

  // Block 7: Plumbing Finish (open_for_bids - depends on countertops)
  insertBlock.run(7, 1, "Plumbing Fixture Installation", "Install undermount sink, faucet, garbage disposal, and dishwasher connections. Test all for leaks.", "Plumber", "open_for_bids", "2026-03-03", null, null, "Sink: Kraus KHU100-30. Faucet: Delta Trinsic. Disposal: InSinkErator Evolution.", 7);

  // Block 8: Tile Backsplash (open_for_bids - depends on countertops)
  insertBlock.run(8, 1, "Tile Backsplash Installation", "Install subway tile backsplash from countertop to bottom of wall cabinets. Include outlet cutouts. Grout color: warm gray.", "Tile Installer", "open_for_bids", "2026-03-07", null, null, "Tile: 3x6 white ceramic subway. Pattern: standard brick. Use 1/16 inch spacers.", 8);

  // Block 9: Painting (pending - depends on tile, electrical finish)
  insertBlock.run(9, 1, "Kitchen Painting", "Paint walls, ceiling, and trim. Two coats on walls, one on ceiling. Touch up any cabinet paint if needed.", "Painter", "pending", "2026-03-12", null, null, "Wall color: Benjamin Moore Simply White OC-117. Ceiling: flat white. Trim: semi-gloss white.", 9);

  // Block 10: Final Inspection & Punch List (pending - depends on everything)
  insertBlock.run(10, 1, "Final Inspection & Punch List", "Walk-through with homeowner. Address any punch list items. Final cleaning. Arrange city final inspection for electrical and plumbing permits.", "Carpenter", "pending", "2026-03-17", null, null, "Compile all warranty documents and manuals for homeowner.", 10);

  // Block dependencies
  const insertDep = db.prepare(
    `INSERT INTO block_dependencies (block_id, depends_on_block_id) VALUES (?, ?)`
  );

  // Electrical rough-in depends on demo
  insertDep.run(2, 1);
  // Plumbing rough-in depends on demo
  insertDep.run(3, 1);
  // Cabinet install depends on electrical and plumbing rough-in
  insertDep.run(4, 2);
  insertDep.run(4, 3);
  // Countertop depends on cabinets
  insertDep.run(5, 4);
  // Electrical finish depends on cabinets
  insertDep.run(6, 4);
  // Plumbing finish depends on countertops
  insertDep.run(7, 5);
  // Tile depends on countertops
  insertDep.run(8, 5);
  // Painting depends on tile and electrical finish
  insertDep.run(9, 6);
  insertDep.run(9, 8);
  // Final inspection depends on painting and plumbing finish
  insertDep.run(10, 7);
  insertDep.run(10, 9);

  // Bids
  const insertBid = db.prepare(
    `INSERT INTO bids (block_id, trade_id, price, start_date, duration_days, description, license_info, insurance_info, status, is_revision, original_bid_id, revision_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  // Bids for completed blocks (accepted)
  insertBid.run(1, 5, 2800, "2026-01-14", 5, "Full demo with debris hauling included. We'll protect all adjacent rooms.", "CA-2024-7733", "Liberty Mutual #CA-223344", "accepted", 0, null, null);
  insertBid.run(2, 3, 3200, "2026-01-22", 5, "Complete electrical rough-in per NEC 2023. Includes permit pull.", "EL-2024-4821", "State Farm #EL-991234", "accepted", 0, null, null);
  insertBid.run(3, 4, 2900, "2026-01-29", 4, "All plumbing rough-in including gas line. City inspection included.", "PL-2024-1192", "Allstate #PL-445566", "accepted", 0, null, null);

  // Bids for cabinet installation (one accepted, one rejected)
  insertBid.run(4, 5, 4500, "2026-02-05", 8, "Professional cabinet installation with laser leveling.", "CA-2024-7733", "Liberty Mutual #CA-223344", "accepted", 0, null, null);

  // Bids for countertop (accepted)
  insertBid.run(5, 5, 5200, "2026-02-17", 7, "Full template, fabrication, and installation of quartz countertops.", "CA-2024-7733", "Liberty Mutual #CA-223344", "accepted", 0, null, null);

  // Bids for electrical finish (open - multiple bids)
  insertBid.run(6, 3, 2100, "2026-02-20", 4, "Complete electrical finish including pendant installation and under-cabinet LEDs.", "EL-2024-4821", "State Farm #EL-991234", "pending", 0, null, null);

  // Bids for plumbing finish (open - one bid so far)
  insertBid.run(7, 4, 1800, "2026-02-28", 3, "Install all fixtures, connect dishwasher, full leak test.", "PL-2024-1192", "Allstate #PL-445566", "pending", 0, null, null);

  // Bids for tile (open - multiple bids)
  insertBid.run(8, 6, 2400, "2026-02-28", 5, "Professional subway tile installation with precise grout lines.", "TI-2024-5544", "GEICO #TI-112233", "pending", 0, null, null);

  // Some progress updates
  const insertProgress = db.prepare(
    `INSERT INTO progress_updates (block_id, trade_id, status, notes, new_estimated_completion, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  );

  insertProgress.run(1, 5, "in_progress", "Started demolition. Removed upper cabinets.", null, "2026-01-14 09:00:00");
  insertProgress.run(1, 5, "in_progress", "All cabinets and countertops removed. Starting flooring removal.", null, "2026-01-16 14:00:00");
  insertProgress.run(1, 5, "completed", "Demolition complete. Site cleaned and ready for next phase.", null, "2026-01-19 16:00:00");
  insertProgress.run(2, 3, "in_progress", "Started running new circuits from panel.", null, "2026-01-22 08:00:00");
  insertProgress.run(2, 3, "completed", "All circuits run and tested. Passed rough-in inspection.", null, "2026-01-27 15:00:00");
  insertProgress.run(3, 4, "in_progress", "Relocating sink drain.", null, "2026-01-29 08:00:00");
  insertProgress.run(3, 4, "completed", "All plumbing rough-in complete. Gas line tested and approved.", null, "2026-02-02 14:00:00");
  insertProgress.run(4, 5, "in_progress", "Started wall cabinet installation. First row complete.", null, "2026-02-05 09:00:00");
  insertProgress.run(4, 5, "in_progress", "Wall cabinets done. Base cabinets 50% complete. Slight delay due to corner unit fitment issue.", "2026-02-16", "2026-02-10 16:00:00");

  // Notifications
  const insertNotification = db.prepare(
    `INSERT INTO notifications (user_id, type, title, message, related_project_id, related_block_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertNotification.run(3, "bid_accepted", "Bid Accepted!", "Your bid for 'Electrical Rough-In' on Kitchen Remodel has been accepted.", 1, 2, 1, "2026-01-20 10:00:00");
  insertNotification.run(4, "bid_accepted", "Bid Accepted!", "Your bid for 'Plumbing Rough-In' on Kitchen Remodel has been accepted.", 1, 3, 1, "2026-01-20 10:05:00");
  insertNotification.run(5, "bid_accepted", "Bid Accepted!", "Your bid for 'Kitchen Demolition' on Kitchen Remodel has been accepted.", 1, 1, 1, "2026-01-13 10:00:00");
  insertNotification.run(1, "block_delayed", "Block Delayed", "Cabinet Installation has been delayed. New estimated completion: Feb 16, 2026.", 1, 4, 0, "2026-02-10 16:05:00");

  // An appreciation for the demo work
  const insertAppreciation = db.prepare(
    `INSERT INTO appreciations (from_user_id, to_user_id, project_id, block_id, type, amount, message, redeem_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  insertAppreciation.run(1, 5, 1, 1, "lunch", 40, "Great job on the demo! Clean and fast work. Enjoy lunch on me!", generateRedeemCode());
  insertAppreciation.run(1, 3, 1, 2, "coffee", 20, "Thanks for getting the electrical done ahead of schedule!", generateRedeemCode());

  // Second project for David (planning phase)
  insertProject.run(
    2,
    "Bathroom Addition",
    "123 Oak Street, Portland",
    "Bathroom Addition",
    "Adding a full bathroom to the basement including shower, toilet, vanity, and tile work.",
    "planning",
    25000
  );

  // A few blocks for David's project
  insertBlock.run(11, 2, "Bathroom Framing", "Frame walls for new bathroom space including door opening.", "Carpenter", "pending", "2026-03-15", null, null, "Must be load-bearing wall compatible.", 1);
  insertBlock.run(12, 2, "Bathroom Plumbing Rough-In", "Run drain, supply, and vent lines for toilet, shower, and vanity.", "Plumber", "pending", "2026-03-25", null, null, "Requires permit. Must tie into existing main stack.", 2);
  insertBlock.run(13, 2, "Bathroom Electrical", "Run circuits for lights, fan, GFCI outlets, and heated floor.", "Electrician", "pending", "2026-03-25", null, null, "All outlets must be GFCI protected.", 3);
  insertBlock.run(14, 2, "Tile & Shower Installation", "Install shower pan, tile shower walls and floor, install vanity tile.", "Tile Installer", "pending", "2026-04-10", null, null, "Waterproofing membrane required (Kerdi or equivalent).", 4);
  insertBlock.run(15, 2, "Bathroom Fixtures & Finish", "Install toilet, vanity, mirror, fixtures, and accessories.", "Plumber", "pending", "2026-04-17", null, null, "Fixtures TBD by homeowner.", 5);

  // Dependencies for bathroom project
  insertDep.run(12, 11);
  insertDep.run(13, 11);
  insertDep.run(14, 12);
  insertDep.run(14, 13);
  insertDep.run(15, 14);

  console.log("Database seeded successfully!");
}

// Run if executed directly
seedDatabase();
