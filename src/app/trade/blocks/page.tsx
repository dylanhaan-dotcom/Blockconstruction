"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "@/lib/context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { Block } from "@/lib/types";
import { Search, Filter, MapPin, Calendar, Users } from "lucide-react";

export default function BrowseBlocksPage() {
  const { currentUser } = useApp();
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradeTypeFilter, setTradeTypeFilter] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "trade") {
      router.push("/");
      return;
    }
    const params = new URLSearchParams();
    if (!showAll) params.set("available", "true");
    if (tradeTypeFilter) params.set("trade_type", tradeTypeFilter);

    fetch(`/api/blocks?${params}`).then((r) => r.json()).then((b) => {
      setBlocks(b);
      setLoading(false);
    });
  }, [currentUser, router, tradeTypeFilter, showAll]);

  if (!currentUser || loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Loading...</p></div>;
  }

  const TRADE_TYPES = ["Electrician", "Plumber", "Carpenter", "Tile Installer", "Painter", "HVAC", "Roofer"];

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
            <option value="">All Trade Types</option>
            {TRADE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="rounded"
            />
            Show all statuses
          </label>
          <span className="text-sm text-gray-400">
            {blocks.length} block{blocks.length !== 1 ? "s" : ""} found
          </span>
        </div>
      </div>

      {/* Block Cards */}
      {blocks.length === 0 ? (
        <div className="card text-center py-12">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No blocks match your filters.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {blocks.map((block) => (
            <Link
              key={block.id}
              href={`/trade/blocks/${block.id}`}
              className="card hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                  {block.title}
                </h3>
                <StatusBadge status={block.status} />
              </div>
              <p className="text-sm text-gray-500 mb-3 line-clamp-2">{block.description}</p>

              <div className="space-y-1.5 text-xs text-gray-500">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{block.project_title} &middot; {block.project_address}</span>
                </div>
                {block.trade_type && (
                  <div className="flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5" />
                    <span>{block.trade_type}</span>
                  </div>
                )}
                {block.desired_completion_date && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Target: {block.desired_completion_date}</span>
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
          ))}
        </div>
      )}
    </div>
  );
}
