"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "@/lib/context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { GanttChart } from "@/components/GanttChart";
import { Block, Bid } from "@/lib/types";
import { ArrowLeft, Calendar, Clock, BarChart3, List } from "lucide-react";

type ScheduleView = "gantt" | "list";

interface ScheduleBlock extends Block {
  project_title?: string;
  project_address?: string;
  bid_price?: number;
  bid_start_date?: string;
  bid_duration_days?: number;
}

export default function TradeSchedulePage() {
  const { currentUser } = useApp();
  const router = useRouter();
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ScheduleView>("gantt");

  useEffect(() => {
    if (!currentUser || currentUser.role !== "trade") {
      router.push("/");
      return;
    }

    // Fetch accepted bids for this trade, then fetch block details
    fetch(`/api/bids?trade_id=${currentUser.id}&status=accepted`)
      .then((r) => r.json())
      .then(async (bids: (Bid & { block_title?: string; project_title?: string })[]) => {
        // For each accepted bid, fetch the full block detail
        const blockPromises = bids.map(async (bid) => {
          const blockRes = await fetch(`/api/blocks/${bid.block_id}`);
          const blockData = await blockRes.json();
          return {
            ...blockData,
            bid_price: bid.price,
            bid_start_date: bid.start_date,
            bid_duration_days: bid.duration_days,
          } as ScheduleBlock;
        });
        const fetchedBlocks = await Promise.all(blockPromises);
        // Sort by start date or desired completion date
        fetchedBlocks.sort((a, b) => {
          const dateA = a.bid_start_date || a.desired_completion_date || "9999";
          const dateB = b.bid_start_date || b.desired_completion_date || "9999";
          return dateA.localeCompare(dateB);
        });
        setBlocks(fetchedBlocks);
        setLoading(false);
      });
  }, [currentUser, router]);

  if (!currentUser || loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Loading...</p></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <Link href="/trade/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
          <p className="text-gray-500 text-sm mt-1">
            {blocks.length} accepted block{blocks.length !== 1 ? "s" : ""} across your projects
          </p>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView("gantt")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              view === "gantt" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Gantt
          </button>
          <button
            onClick={() => setView("list")}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
              view === "list" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <List className="w-4 h-4" />
            List
          </button>
        </div>
      </div>

      {blocks.length === 0 ? (
        <div className="card text-center py-12">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-3">No accepted blocks yet.</p>
          <Link href="/trade/blocks" className="btn-primary btn-sm">Browse Available Blocks</Link>
        </div>
      ) : (
        <>
          {view === "gantt" && (
            <GanttChart blocks={blocks} />
          )}

          {view === "list" && (
            <div className="space-y-3">
              {blocks.map((block) => (
                <Link
                  key={block.id}
                  href={`/trade/blocks/${block.id}`}
                  className="card !p-4 block hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold text-gray-900">{block.title}</span>
                        <StatusBadge status={block.status} />
                        {block.trade_type && (
                          <span className="text-xs text-gray-400">{block.trade_type}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{block.project_title} &middot; {block.project_address}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        {block.bid_start_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Start: {block.bid_start_date}
                          </span>
                        )}
                        {block.bid_duration_days && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {block.bid_duration_days} days
                          </span>
                        )}
                        {block.desired_completion_date && (
                          <span>Target: {block.desired_completion_date}</span>
                        )}
                        {block.estimated_completion_date && (
                          <span className={block.status === "delayed" ? "text-red-600" : ""}>
                            Est: {block.estimated_completion_date}
                          </span>
                        )}
                      </div>
                      {block.description && (
                        <p className="text-sm text-gray-500 mt-2 line-clamp-1">{block.description}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {block.bid_price && (
                        <p className="text-lg font-bold text-green-600">${block.bid_price.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
