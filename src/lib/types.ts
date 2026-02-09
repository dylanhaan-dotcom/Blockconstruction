export type UserRole = "homeowner" | "trade";

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  trade_type: string | null;
  license_info: string | null;
  insurance_info: string | null;
  rating: number;
  rating_count: number;
  created_at: string;
}

export type ProjectStatus = "planning" | "bidding" | "in_progress" | "completed";

export interface Project {
  id: number;
  owner_id: number;
  title: string;
  address: string;
  project_type: string;
  description: string | null;
  status: ProjectStatus;
  budget: number | null;
  allow_parallel_bidding: number;
  share_token: string | null;
  created_at: string;
  updated_at: string;
  owner_name?: string;
  block_count?: number;
  completed_blocks?: number;
  total_awarded?: number;
}

export type BlockStatus = "pending" | "open_for_bids" | "awarded" | "in_progress" | "completed" | "delayed";

export interface Block {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  trade_type: string | null;
  status: BlockStatus;
  desired_completion_date: string | null;
  estimated_completion_date: string | null;
  actual_completion_date: string | null;
  special_requirements: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  project_title?: string;
  project_address?: string;
  bid_count?: number;
  awarded_trade?: string;
  awarded_price?: number;
  dependencies?: number[];
  dependency_names?: string[];
  depends_on_completed?: boolean;
}

export type BidStatus = "pending" | "accepted" | "rejected" | "revised" | "needs_confirmation";

export interface Bid {
  id: number;
  block_id: number;
  trade_id: number;
  price: number;
  start_date: string | null;
  duration_days: number | null;
  description: string | null;
  license_info: string | null;
  insurance_info: string | null;
  status: BidStatus;
  is_revision: number;
  original_bid_id: number | null;
  revision_reason: string | null;
  delay_confirmed: number;
  created_at: string;
  updated_at: string;
  trade_name?: string;
  trade_type?: string;
  trade_rating?: number;
  trade_rating_count?: number;
}

export interface ProgressUpdate {
  id: number;
  block_id: number;
  trade_id: number;
  status: string;
  notes: string | null;
  new_estimated_completion: string | null;
  created_at: string;
  trade_name?: string;
}

export interface Notification {
  id: number;
  user_id: number;
  type: string;
  title: string;
  message: string;
  related_project_id: number | null;
  related_block_id: number | null;
  is_read: number;
  created_at: string;
}

export type AppreciationType = "coffee" | "lunch" | "dinner" | "custom";

export interface Appreciation {
  id: number;
  from_user_id: number;
  to_user_id: number;
  project_id: number | null;
  block_id: number | null;
  type: AppreciationType;
  amount: number;
  message: string | null;
  redeem_code: string;
  redeemed: number;
  created_at: string;
  from_name?: string;
  to_name?: string;
  project_title?: string;
  block_title?: string;
}

export interface ProjectTemplate {
  name: string;
  project_type: string;
  blocks: {
    title: string;
    description: string;
    trade_type: string;
    special_requirements: string;
    depends_on: number[];
  }[];
}
