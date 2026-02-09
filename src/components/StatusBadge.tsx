"use client";

import React from "react";
import { clsx } from "clsx";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  // Block statuses
  pending: { label: "Pending", className: "bg-gray-100 text-gray-700" },
  open_for_bids: { label: "Open for Bids", className: "bg-blue-100 text-blue-700" },
  awarded: { label: "Awarded", className: "bg-purple-100 text-purple-700" },
  in_progress: { label: "In Progress", className: "bg-yellow-100 text-yellow-800" },
  completed: { label: "Completed", className: "bg-green-100 text-green-700" },
  delayed: { label: "Delayed", className: "bg-red-100 text-red-700" },
  // Project statuses
  planning: { label: "Planning", className: "bg-gray-100 text-gray-700" },
  bidding: { label: "Bidding", className: "bg-blue-100 text-blue-700" },
  // Bid statuses
  accepted: { label: "Accepted", className: "bg-green-100 text-green-700" },
  rejected: { label: "Not Selected", className: "bg-red-100 text-red-700" },
  revised: { label: "Revised", className: "bg-orange-100 text-orange-700" },
  needs_confirmation: { label: "Needs Confirmation", className: "bg-amber-100 text-amber-800" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { label: status, className: "bg-gray-100 text-gray-700" };

  return (
    <span className={clsx("badge", config.className)}>
      {config.label}
    </span>
  );
}
