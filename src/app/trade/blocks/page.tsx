"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "@/lib/context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { Block } from "@/lib/types";
import { TRADE_TYPES } from "@/lib/trades";
import { Search, Filter, MapPin, Calendar, Users, Send, Layers, LayoutGrid, ArrowRight } from "lucide-react";

const MY_TRADES = "__mine__";

type BidFilter = "all" | "not_bid" | "my_bids";

export default function BrowseBlocksPage() {
  const { currentUser, loading: sessionLoading } = useApp();
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradeTypeFilter, setTradeTypeFilter] = useState(MY_TRADES);
  const [bidFilter, setBidFilter] = useState<BidFilter>("all");
  const [showAll, setShowAll] = useState(false);
  const [groupByProject, setGroupByProject] = useState(true);

  const myTrades = currentUser
    ? [currentUser.trade_type, ...(currentUser.secondary_trades || [])].filter((t): t is string => !!t)
    : [];
  const myTradesKey = myTrades.join(",");

  useEffect(() => {
    if (sessionLoading) return;
    if (!currentUser || currentUser.role !== "trade") {
      router.push("/");
      return;
    }
    const params = new URLSearchParams();
    // Blocks you've bid on stay listed after bidding closes
    if (!showAll && bidFilter !== "my_bids") params.set("available", "true");
    if (tradeTypeFilter === MY_TRADES) {
      if (myTradesKey) params.set("trade_types", myTradesKey);
    } else if (tradeTypeFilter) {
      params.set("trade_type", tradeTypeFilter);
    }

    fetch(`/api/blocks?${params}`).then((r) => r.json()).then((b) => {
      setBlocks(b);
      setLoading(false);
    });
  }, [currentUser?.id, sessionLoading, router, tradeTypeFilter, showAll, bidFilter, myTradesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!currentUser || loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Loading...</p></div>;
  }

  const visibleBlocks = blocks.filter((b) =>
    bidFilter === "my_bids" ? !!b.my_bid_id : bidFilter === "not_bid" ? !b.my_bid_id : true
  );
  const myBidCount = blocks.filter((b) => b.my_bid_id).length;

  // Keep each project's phases together, in the order projects first appear
  const projectGroups: { projectId: number; title: string; address: string; blocks: Block[] }[] = [];
  for (const block of visibleBlocks) {
    let group = projectGroups.find((g) => g.projectId === block.project_id);
    if (!group) {
      group = { projectId: block.project_id, title: block.project_title || "Project", address: block.project_address || "", blocks: [] };
      projectGroups.push(group);
    }
    group.blocks.push(block);
  }

  const renderCard = (block: Block) => (
    <Link
      key={block.id}
      href={`/trade/blocks/${block.id}`}
      className={`card hover:shadow-md transition-shadow group ${block.my_bid_id ? "ring-2 ring-primary-200" : ""}`}
    >
      {block.my_bid_id && block.my_bid_status && (
        <div className="flex items-center justify-between gap-2 -mt-1 mb-3 px-3 py-1.5 rounded-lg bg-primary-50 text-primary-700 text-xs font-medium">
          <span className="flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" />
            You bid{block.my_bid_price != null ? ` $${block.my_bid_price.toLocaleString()}` : ""}
          </span>
          <StatusBadge status={block.my_bid_status} />
        </div>
      )}
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
          {block.title}
        </h3>
        <StatusBadge status={block.status} />
      </div>
      <p className="text-sm text-gray-500 mb-3 line-clamp-2">{block.description}</p>

      <div className="space-y-1.5 text-xs text-gray-500">
        {!groupByProject && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            <span>{block.project_title} &middot; {block.project_address}</span>
          </div>
        )}
        {block.trade_type && (
          <div className="flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5" />
            <span>{block.trade_type}</span>
          </div>
        )}
        {(block.desired_start_date || block.desired_completion_date) && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            <span>
              Target: {block.desired_start_date ? `${block.desired_start_date} → ` : ""}
              {block.desired_completion_date || "open"}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          <span>{block.bid_count || 0} bid{(block.bid_count || 0) !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {block.dependency_names && block.dependency_names.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            Depends on: {block.dependency_names.join(", ")}
          </p>
          {!block.depends_on_completed && (
            <p className="text-xs text-amber-600 mt-0.5">⚠ Upstream blocks not yet complete</p>
          )}
        </div>
      )}
    </Link>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Browse Work Blocks</h1>
          <p className="text-gray-500 text-sm mt-1">Find blocks that match your trade and submit bids</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-600">Filter:</span>
          </div>
          <select
            className="input !w-auto"
            value={tradeTypeFilter}
            onChange={(e) => setTradeTypeFilter(e.target.value)}
          >
            {myTrades.length > 0 && <option value={MY_TRADES}>My trades ({myTrades.join(", ")})</option>}
            <option value="">All Trade Types</option>
            {TRADE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {([
              ["all", "All"],
              ["not_bid", "Not bid yet"],
              ["my_bids", "My bids"],
            ] as [BidFilter, string][]).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setBidFilter(value)}
                className={`px-3 py-1.5 ${bidFilter === value ? "bg-primary-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showAll || bidFilter === "my_bids"}
              disabled={bidFilter === "my_bids"}
              onChange={(e) => setShowAll(e.target.checked)}
              className="rounded"
            />
            Show all statuses
          </label>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            <button
              type="button"
              onClick={() => setGroupByProject(true)}
              className={`px-3 py-1.5 flex items-center gap-1.5 ${groupByProject ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              <Layers className="w-3.5 h-3.5" /> By project
            </button>
            <button
              type="button"
              onClick={() => setGroupByProject(false)}
              className={`px-3 py-1.5 flex items-center gap-1.5 ${!groupByProject ? "bg-gray-800 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> All blocks
            </button>
          </div>
          <span className="text-sm text-gray-400">
            {visibleBlocks.length} block{visibleBlocks.length !== 1 ? "s" : ""} found
            {bidFilter === "all" && myBidCount > 0 && ` · you've bid on ${myBidCount}`}
          </span>
        </div>
      </div>

      {/* Block Cards */}
      {visibleBlocks.length === 0 ? (
        <div className="card text-center py-12">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {bidFilter === "my_bids" ? "You haven't bid on any blocks that match these filters." : "No blocks match your filters."}
          </p>
        </div>
      ) : groupByProject ? (
        <div className="space-y-8">
          {projectGroups.map((group) => (
            <section key={group.projectId}>
              <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{group.title}</h2>
                  <p className="text-sm text-gray-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {group.address} &middot; {group.blocks.length} matching block{group.blocks.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <Link
                  href={`/trade/projects/${group.projectId}`}
                  className="btn-secondary btn-sm flex items-center gap-1.5"
                >
                  View whole project &amp; bid on several
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.blocks.map(renderCard)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleBlocks.map(renderCard)}
        </div>
      )}
    </div>
  );
}
