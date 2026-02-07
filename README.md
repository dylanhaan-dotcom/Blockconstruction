# BlockConstruction - Modular Construction Project Management

A platform that connects homeowners with trades through modularized work "blocks." Homeowners break projects into standardized blocks, trades bid on individual blocks, and the system dynamically adjusts when timelines change.

## Quick Start

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Or build and start production
npm run build && npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

The database is automatically created and seeded with sample data on first launch. To reset the data, delete `blockconstruction.db` and restart the server.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: SQLite via better-sqlite3
- **Styling**: Tailwind CSS
- **Icons**: Lucide React

## Features

### User Types
- **Homeowner / Project Owner** - Creates projects, manages blocks, reviews bids, sends appreciation rewards
- **Trade Contractor** - Browses available blocks, submits bids, updates progress

No authentication required for MVP. Select any user from the user switcher in the top navigation.

### Project Creation (Homeowner)
- Create projects with address, type, description, and budget
- Break projects into blocks with titles, descriptions, trade types, and dependencies
- Use templates (Bathroom Remodel, Kitchen Remodel, Deck Construction) to auto-populate blocks
- Set desired completion dates and special requirements per block

### Bidding System (Trade)
- Browse all available blocks with filtering by trade type
- Submit bids with price, start date, duration, approach description, and license/insurance info
- See dependency status (upstream blocks that must complete first)
- Submit revised bids when timelines shift due to upstream delays

### Bid Selection (Homeowner)
- View all bids for each block within the project detail view
- See trade ratings, license info, and approach descriptions
- Accept a bid to award the block (other bids auto-rejected)
- Notifications sent to winning and non-winning trades

### Progress Tracking (Trade)
- Update block status: In Progress / Completed / Delayed
- Add progress notes
- When marking as delayed, specify new estimated completion date
- When a block is completed, downstream blocks automatically become available for bidding

### Dynamic Adjustment (Automatic)
- When a block is marked "Delayed":
  - All downstream dependent blocks' trades are notified
  - Trades can submit revised bids reflecting the new timeline
  - Revised bids are clearly marked as "Revised" with the reason
  - Homeowner is notified of the delay
- When a block is completed, pending downstream blocks auto-open for bids

### Appreciation System (Homeowner)
- Send rewards to trades: Coffee ($20), Lunch ($40), Dinner ($75), or Custom amount
- Include personal messages
- Trade receives notification with redeem code and partner restaurant list
- Track all appreciation sent/received on dashboards

### Dashboards
- **Homeowner Dashboard**: All projects, block completion stats, budget vs. awarded tracking, appreciation sent
- **Trade Dashboard**: Active bids, won projects, earnings, appreciation received
- **Project Detail**: Timeline view with dependency visualization, block status, bid management, progress history

### Notifications
- Bid accepted/rejected notifications
- Block delay notifications to downstream trades
- Appreciation reward notifications
- Unread count badge in navigation
- Mark individual or all notifications as read

## Seed Data

The database comes pre-loaded with:

| Entity | Details |
|--------|---------|
| **Homeowners** | Sarah Mitchell, David Chen |
| **Trades** | Mike's Electric (Electrician, 4.8★), Rivera Plumbing (Plumber, 4.5★), Oakwood Carpentry (Carpenter, 4.9★), ProTile Solutions (Tile Installer, 4.2★), Summit Painting Co (Painter, 4.6★) |
| **Kitchen Remodel** (Sarah) | 10 blocks in various states - 3 completed, 1 in progress, 1 awarded, 4 open for bids, 1 pending |
| **Bathroom Addition** (David) | 5 blocks all in planning state |
| **Sample Bids** | Multiple bids across blocks, some accepted, some pending |
| **Progress Updates** | History of demo, electrical, plumbing, and cabinet installation progress |
| **Appreciations** | Lunch reward and coffee reward already sent |
| **Notifications** | Mix of read and unread notifications |

The Cabinet Installation block (Block #4) has a slight delay, making it a good test case for the dynamic adjustment flow.

## Sample User Flows to Test

### Flow 1: Homeowner Reviews Bids and Awards a Block
1. Log in as **Sarah Mitchell** (Homeowner)
2. Click on **Kitchen Remodel** project
3. Expand **Electrical Finish Work** block (open for bids)
4. Review the bid from Mike's Electric
5. Click **Accept Bid** to award the block

### Flow 2: Trade Submits a Bid
1. Log in as **Summit Painting Co** (Trade)
2. Click **Browse Blocks** in navigation
3. Find **Kitchen Painting** or **Tile Backsplash** blocks
4. Click into the block detail
5. Click **Submit Bid** and fill out the form

### Flow 3: Trade Reports a Delay (Dynamic Adjustment)
1. Log in as **Oakwood Carpentry** (Trade)
2. Go to Dashboard, click on the **Cabinet Installation** bid
3. Click **Update Progress**
4. Set status to **Delayed**, add a new estimated completion date, and notes
5. Submit the update
6. Switch to **Sarah Mitchell** - check notifications for the delay alert
7. Switch to any downstream trade - they should see delay notifications too

### Flow 4: Trade Completes a Block
1. Log in as **Oakwood Carpentry** (Trade)
2. Navigate to the Cabinet Installation block
3. Click **Update Progress**, set to **Completed**
4. Switch to **Sarah Mitchell** - the Countertop block should now be ready
5. Downstream blocks that were "pending" may become "open_for_bids"

### Flow 5: Homeowner Sends Appreciation
1. Log in as **Sarah Mitchell** (Homeowner)
2. Open **Kitchen Remodel** project
3. Expand a completed block (e.g., Kitchen Demolition)
4. Click **Send Appreciation** next to the accepted bid
5. Select Coffee/Lunch/Dinner, add a message, and send
6. Switch to the trade to see the reward in their dashboard

### Flow 6: Create a New Project from Template
1. Log in as **David Chen** (Homeowner)
2. Click **New Project** in navigation
3. Click **Deck Construction** template
4. Blocks auto-populate with titles, descriptions, trade types, and dependencies
5. Adjust details and click **Create Project**
6. View the new project on the dashboard

### Flow 7: Trade Submits a Revised Bid
1. Log in as a trade that has an existing pending bid
2. Navigate to that block
3. Click **Submit Revised Bid**
4. Enter a new price and note the revision reason (e.g., "Timeline shifted due to upstream delay")
5. The revised bid is clearly marked in the bid list

## Project Structure

```
src/
  app/
    api/              # REST API routes
      appreciation/   # Send/receive rewards
      bids/           # Submit and manage bids
      blocks/         # Block CRUD + progress updates
      notifications/  # User notifications
      projects/       # Project CRUD
      templates/      # Project templates
      users/          # User listing
    homeowner/        # Homeowner pages
      projects/
        new/          # Create new project
        [id]/         # Project detail view
    trade/            # Trade pages
      blocks/         # Browse + block detail
      dashboard/      # Trade dashboard
  components/         # Shared UI components
  lib/                # Database, types, context, templates, seed
```

## Known Limitations (MVP)

- No real authentication - user switching via dropdown
- No file upload for progress photos
- No real email/SMS notifications - in-app only
- Appreciation rewards use placeholder partner restaurants and random redeem codes
- Trade ratings are static (seeded values, not calculated from reviews)
- No calendar view (timeline is list-based)
- No real-time updates (requires page refresh to see changes from other users)
- SQLite is single-file, not suitable for production multi-server deployment
- No input validation beyond HTML form validation
- No pagination on lists

## Resetting Data

Delete the database file and restart the server:

```bash
rm blockconstruction.db
npm run dev
```

The database will be recreated and re-seeded automatically.
