"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import { useApp } from "@/lib/context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { Block, Bid, Project, Appreciation, ProgressUpdate } from "@/lib/types";
import {
  ArrowLeft, ChevronDown, ChevronUp, DollarSign, Heart,
  Clock, CheckCircle2, AlertTriangle, ArrowRight, Coffee, UtensilsCrossed, X
} from "lucide-react";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { currentUser, refreshNotifications } = useApp();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [expandedBlock, setExpandedBlock] = useState<number | null>(null);
  const [blockDetail, setBlockDetail] = useState<Record<string, unknown> | null>(null);
  const [appreciations, setAppreciations] = useState<Appreciation[]>([]);
  const [showAppreciationModal, setShowAppreciationModal] = useState<{ tradeId: number; tradeName: string; blockId?: number } | null>(null);
  const [appreciationType, setAppreciationType] = useState<string>("coffee");
  const [customAmount, setCustomAmount] = useState("");
  const [appreciationMessage, setAppreciationMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/projects/${id}`).then((r) => r.json()),
      fetch(`/api/blocks?project_id=${id}`).then((r) => r.json()),
      fetch(`/api/appreciation?from_user_id=${currentUser?.id}`).then((r) => r.json()),
    ]).then(([p, b, a]) => {
      setProject(p);
      setBlocks(b);
      setAppreciations(a);
      setLoading(false);
    });
  }, [id, currentUser?.id]);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "homeowner") {
      router.push("/");
      return;
    }
    fetchData();
  }, [currentUser, router, fetchData]);

  const fetchBlockDetail = async (blockId: number) => {
    const res = await fetch(`/api/blocks/${blockId}`);
    const data = await res.json();
    setBlockDetail(data);
  };

  const toggleBlock = (blockId: number) => {
    if (expandedBlock === blockId) {
      setExpandedBlock(null);
      setBlockDetail(null);
    } else {
      setExpandedBlock(blockId);
      fetchBlockDetail(blockId);
    }
  };

  const openForBids = async (blockId: number) => {
    await fetch(`/api/blocks/${blockId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "open_for_bids" }),
    });
    fetchData();
    if (expandedBlock === blockId) fetchBlockDetail(blockId);
  };

  const acceptBid = async (bidId: number) => {
    await fetch(`/api/bids/${bidId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "accepted" }),
    });
    fetchData();
    if (expandedBlock) fetchBlockDetail(expandedBlock);
    refreshNotifications();
  };

  const sendAppreciation = async () => {
    if (!showAppreciationModal || !currentUser) return;
    const amounts: Record<string, number> = { coffee: 20, lunch: 40, dinner: 75 };
    const amount = appreciationType === "custom" ? Number(customAmount) : amounts[appreciationType];

    await fetch("/api/appreciation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_user_id: currentUser.id,
        to_user_id: showAppreciationModal.tradeId,
        project_id: Number(id),
        block_id: showAppreciationModal.blockId || null,
        type: appreciationType,
        amount,
        message: appreciationMessage,
      }),
    });

    setShowAppreciationModal(null);
    setAppreciationMessage("");
    setAppreciationType("coffee");
    setCustomAmount("");
    fetchData();
    refreshNotifications();
  };

  if (loading || !project) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Loading...</p></div>;
  }

  // Build dependency graph for visual
  const blockMap = new Map(blocks.map((b) => [b.id, b]));

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "in_progress": return <Clock className="w-5 h-5 text-yellow-500" />;
      case "delayed": return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default: return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <Link href="/homeowner" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      {/* Project Header */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{project.title}</h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-gray-500 text-sm">{project.address}</p>
            {project.description && <p className="text-sm text-gray-600 mt-2">{project.description}</p>}
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{blocks.length}</p>
              <p className="text-gray-500">Blocks</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {blocks.filter((b) => b.status === "completed").length}
              </p>
              <p className="text-gray-500">Done</p>
            </div>
            {project.budget && (
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">${project.budget.toLocaleString()}</p>
                <p className="text-gray-500">Budget</p>
              </div>
            )}
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-4 w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-primary-500 h-2.5 rounded-full transition-all"
            style={{
              width: `${blocks.length ? (blocks.filter((b) => b.status === "completed").length / blocks.length) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Timeline View */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">Project Timeline</h2>
        <div className="card overflow-x-auto">
          <div className="min-w-[600px]">
            {blocks.map((block, idx) => (
              <div key={block.id} className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0">
                {/* Status icon and connector */}
                <div className="flex flex-col items-center w-8 shrink-0">
                  {statusIcon(block.status)}
                  {idx < blocks.length - 1 && <div className="w-0.5 h-4 bg-gray-200 mt-1" />}
                </div>

                {/* Block info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{block.title}</span>
                    <StatusBadge status={block.status} />
                    {block.bid_count && block.bid_count > 0 && (
                      <span className="text-xs text-gray-400">{block.bid_count} bid(s)</span>
                    )}
                  </div>
                  {/* Dependencies */}
                  {block.dependency_names && block.dependency_names.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Depends on: {block.dependency_names.join(", ")}
                    </p>
                  )}
                </div>

                {/* Dates */}
                <div className="text-right shrink-0">
                  {block.actual_completion_date && (
                    <p className="text-xs text-green-600">Done: {block.actual_completion_date}</p>
                  )}
                  {block.estimated_completion_date && !block.actual_completion_date && (
                    <p className={`text-xs ${block.status === "delayed" ? "text-red-600" : "text-gray-500"}`}>
                      Est: {block.estimated_completion_date}
                    </p>
                  )}
                  {block.desired_completion_date && !block.actual_completion_date && !block.estimated_completion_date && (
                    <p className="text-xs text-gray-400">Target: {block.desired_completion_date}</p>
                  )}
                </div>

                {/* Awarded trade/price */}
                <div className="text-right shrink-0 w-32">
                  {block.awarded_trade && (
                    <p className="text-xs font-medium text-gray-700">{block.awarded_trade}</p>
                  )}
                  {block.awarded_price && (
                    <p className="text-xs text-green-600">${block.awarded_price.toLocaleString()}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Block Cards */}
      <h2 className="text-lg font-semibold mb-4">Blocks Detail</h2>
      <div className="space-y-3">
        {blocks.map((block) => (
          <div key={block.id} className="card !p-0 overflow-hidden">
            {/* Block header (clickable) */}
            <button
              onClick={() => toggleBlock(block.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                {statusIcon(block.status)}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{block.title}</span>
                    <StatusBadge status={block.status} />
                    {block.trade_type && (
                      <span className="text-xs text-gray-400">{block.trade_type}</span>
                    )}
                  </div>
                  {block.description && (
                    <p className="text-sm text-gray-500 truncate mt-0.5">{block.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0 ml-4">
                {block.awarded_price && (
                  <span className="text-sm font-medium text-green-600">${block.awarded_price.toLocaleString()}</span>
                )}
                {block.bid_count && block.bid_count > 0 && (
                  <span className="badge bg-blue-100 text-blue-700">{block.bid_count} bids</span>
                )}
                {expandedBlock === block.id ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>

            {/* Expanded detail */}
            {expandedBlock === block.id && blockDetail && (
              <div className="border-t border-gray-100 p-4 bg-gray-50">
                {/* Block info */}
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase">Description</p>
                    <p className="text-sm text-gray-700 mt-1">{block.description || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase">Special Requirements</p>
                    <p className="text-sm text-gray-700 mt-1">{block.special_requirements || "None"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase">Dependencies</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {(blockDetail.dependency_blocks as { id: number; title: string; status: string }[])?.map((dep) => (
                        <span key={dep.id} className="inline-flex items-center gap-1 text-xs bg-white border rounded px-2 py-0.5">
                          {dep.status === "completed" ? (
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                          ) : (
                            <Clock className="w-3 h-3 text-gray-400" />
                          )}
                          {dep.title}
                        </span>
                      )) || <span className="text-sm text-gray-500">None</span>}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase">Downstream Blocks</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {(blockDetail.downstream_blocks as { id: number; title: string; status: string }[])?.map((ds) => (
                        <span key={ds.id} className="inline-flex items-center gap-1 text-xs bg-white border rounded px-2 py-0.5">
                          <ArrowRight className="w-3 h-3 text-gray-400" />
                          {ds.title}
                        </span>
                      )) || <span className="text-sm text-gray-500">None</span>}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {block.status === "pending" && block.depends_on_completed && (
                  <button onClick={() => openForBids(block.id)} className="btn-primary btn-sm mb-4">
                    Open for Bids
                  </button>
                )}
                {block.status === "pending" && !block.depends_on_completed && (
                  <p className="text-sm text-amber-600 mb-4 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" />
                    Waiting for upstream blocks to complete before opening for bids.
                  </p>
                )}

                {/* Bids */}
                {(blockDetail.bids as Bid[])?.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold mb-3">Bids</h3>
                    <div className="space-y-2">
                      {(blockDetail.bids as Bid[]).map((bid: Bid) => (
                        <div
                          key={bid.id}
                          className={`bg-white rounded-lg border p-3 ${bid.status === "accepted" ? "border-green-300 bg-green-50" : "border-gray-200"}`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{bid.trade_name}</span>
                                <span className="text-xs text-gray-400">{bid.trade_type}</span>
                                {bid.trade_rating && bid.trade_rating > 0 && (
                                  <span className="text-xs text-yellow-600">
                                    {bid.trade_rating} ★ ({bid.trade_rating_count})
                                  </span>
                                )}
                                <StatusBadge status={bid.status} />
                                {bid.is_revision ? (
                                  <span className="badge bg-orange-100 text-orange-700">Revised bid</span>
                                ) : null}
                              </div>
                              {bid.description && (
                                <p className="text-sm text-gray-600 mt-1">{bid.description}</p>
                              )}
                              {bid.revision_reason && (
                                <p className="text-xs text-orange-600 mt-1">Revision reason: {bid.revision_reason}</p>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                {bid.start_date && <span>Start: {bid.start_date}</span>}
                                {bid.duration_days && <span>Duration: {bid.duration_days} days</span>}
                                <span>License: {bid.license_info || "N/A"}</span>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-lg font-bold text-gray-900">${bid.price.toLocaleString()}</p>
                              {bid.status === "pending" && block.status !== "awarded" && block.status !== "in_progress" && block.status !== "completed" && (
                                <button
                                  onClick={() => acceptBid(bid.id)}
                                  className="btn-primary btn-sm mt-2"
                                >
                                  Accept Bid
                                </button>
                              )}
                              {bid.status === "accepted" && (
                                <button
                                  onClick={() =>
                                    setShowAppreciationModal({
                                      tradeId: bid.trade_id,
                                      tradeName: bid.trade_name || "Trade",
                                      blockId: block.id,
                                    })
                                  }
                                  className="flex items-center gap-1 text-xs text-pink-600 hover:text-pink-700 mt-2"
                                >
                                  <Heart className="w-3.5 h-3.5" />
                                  Send Appreciation
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Progress Updates */}
                {(blockDetail.progress_updates as ProgressUpdate[])?.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold mb-3">Progress Updates</h3>
                    <div className="space-y-2">
                      {(blockDetail.progress_updates as ProgressUpdate[]).map((update: ProgressUpdate) => (
                        <div key={update.id} className="bg-white rounded-lg border border-gray-200 p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <StatusBadge status={update.status} />
                            <span className="text-xs text-gray-500">{update.trade_name}</span>
                            <span className="text-xs text-gray-400">
                              {new Date(update.created_at).toLocaleString()}
                            </span>
                          </div>
                          {update.notes && <p className="text-sm text-gray-700">{update.notes}</p>}
                          {update.new_estimated_completion && (
                            <p className="text-xs text-amber-600 mt-1">
                              New estimated completion: {update.new_estimated_completion}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Appreciation History */}
      {appreciations.filter((a) => a.project_id === Number(id)).length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-500" />
            Appreciation Sent
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {appreciations
              .filter((a) => a.project_id === Number(id))
              .map((a) => (
                <div key={a.id} className="card !p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {a.type === "coffee" && <Coffee className="w-4 h-4 text-amber-600" />}
                    {a.type === "lunch" && <UtensilsCrossed className="w-4 h-4 text-green-600" />}
                    {a.type === "dinner" && <UtensilsCrossed className="w-4 h-4 text-purple-600" />}
                    {a.type === "custom" && <Heart className="w-4 h-4 text-pink-600" />}
                    <span className="text-sm font-medium">{a.type.charAt(0).toUpperCase() + a.type.slice(1)} for {a.to_name}</span>
                    <span className="text-sm font-bold text-green-600 ml-auto">${a.amount}</span>
                  </div>
                  {a.message && <p className="text-xs text-gray-600 italic">&ldquo;{a.message}&rdquo;</p>}
                  <p className="text-xs text-gray-400 mt-1">Code: {a.redeem_code}</p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Appreciation Modal */}
      {showAppreciationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Heart className="w-5 h-5 text-pink-500" />
                Send Appreciation
              </h3>
              <button onClick={() => setShowAppreciationModal(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Show your thanks to <strong>{showAppreciationModal.tradeName}</strong> with a reward they can redeem at partner restaurants.
            </p>

            <div className="grid grid-cols-2 gap-2 mb-4">
              {[
                { type: "coffee", label: "Coffee", amount: 20, icon: "☕" },
                { type: "lunch", label: "Lunch", amount: 40, icon: "🥗" },
                { type: "dinner", label: "Dinner", amount: 75, icon: "🍽️" },
                { type: "custom", label: "Custom", amount: 0, icon: "💝" },
              ].map((option) => (
                <button
                  key={option.type}
                  onClick={() => setAppreciationType(option.type)}
                  className={`p-3 rounded-lg border-2 text-left transition-colors ${
                    appreciationType === option.type
                      ? "border-pink-500 bg-pink-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="text-2xl">{option.icon}</span>
                  <p className="font-medium text-sm mt-1">{option.label}</p>
                  {option.amount > 0 && (
                    <p className="text-xs text-gray-500">${option.amount}</p>
                  )}
                </button>
              ))}
            </div>

            {appreciationType === "custom" && (
              <div className="mb-4">
                <label className="label">Custom Amount ($)</label>
                <input
                  className="input"
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Enter amount"
                  min="1"
                />
              </div>
            )}

            <div className="mb-4">
              <label className="label">Personal Message (optional)</label>
              <textarea
                className="input"
                rows={3}
                value={appreciationMessage}
                onChange={(e) => setAppreciationMessage(e.target.value)}
                placeholder="e.g., Great work on the electrical! Really appreciate the attention to detail."
              />
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-xs font-medium text-gray-500 mb-1.5">Partner Restaurants</p>
              <div className="space-y-1 text-xs text-gray-600">
                <p>The Sawmill Grill &middot; Blueprint Café &middot; Cornerstone Bistro</p>
                <p>The Beam & Truss &middot; Level Line Sushi</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={sendAppreciation}
                disabled={appreciationType === "custom" && !customAmount}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <Heart className="w-4 h-4" />
                Send {appreciationType !== "custom" ? `$${appreciationType === "coffee" ? 20 : appreciationType === "lunch" ? 40 : 75}` : customAmount ? `$${customAmount}` : ""} Reward
              </button>
              <button onClick={() => setShowAppreciationModal(null)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
