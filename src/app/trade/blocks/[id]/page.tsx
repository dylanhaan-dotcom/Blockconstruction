"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import { useApp } from "@/lib/context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { Bid, ProgressUpdate } from "@/lib/types";
import {
  ArrowLeft, MapPin, Calendar, Clock, CheckCircle2,
  AlertTriangle, Send, ArrowRight, ClipboardEdit, Pencil
} from "lucide-react";

interface DepBlock { id: number; title: string; status: string }

interface BlockDetail {
  id: number;
  title: string;
  status: string;
  description: string | null;
  trade_type: string | null;
  special_requirements: string | null;
  desired_completion_date: string | null;
  estimated_completion_date: string | null;
  actual_completion_date: string | null;
  project_title: string;
  project_address: string;
  project_id: number;
  owner_id: number;
  depends_on_completed: boolean;
  dependencies: number[];
  dependency_blocks: DepBlock[];
  downstream_blocks: DepBlock[];
  bids: Bid[];
  progress_updates: ProgressUpdate[];
}

export default function TradeBlockDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { currentUser, loading: sessionLoading, refreshNotifications } = useApp();
  const router = useRouter();
  const [block, setBlock] = useState<BlockDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Bid form
  const [showBidForm, setShowBidForm] = useState(false);
  const [bidPrice, setBidPrice] = useState("");
  const [bidStartDate, setBidStartDate] = useState("");
  const [bidDuration, setBidDuration] = useState("");
  const [bidDescription, setBidDescription] = useState("");
  const [bidLicense, setBidLicense] = useState("");
  const [bidInsurance, setBidInsurance] = useState("");
  const [isRevision, setIsRevision] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit bid state
  const [editingBidId, setEditingBidId] = useState<number | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Progress form
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [progressStatus, setProgressStatus] = useState("in_progress");
  const [progressNotes, setProgressNotes] = useState("");
  const [progressEstDate, setProgressEstDate] = useState("");

  const fetchBlock = useCallback(() => {
    fetch(`/api/blocks/${id}`).then((r) => r.json()).then((data) => {
      setBlock(data);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!currentUser || currentUser.role !== "trade") {
      router.push("/");
      return;
    }
    fetchBlock();
    // Pre-fill license/insurance from user profile
    setBidLicense(currentUser.license_info || "");
    setBidInsurance(currentUser.insurance_info || "");
  }, [currentUser, router, fetchBlock]);

  const submitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSubmitting(true);

    // Find existing bid if revision
    const existingBid = block?.bids?.find(
      (b) => b.trade_id === currentUser.id && b.status === "pending"
    );

    await fetch("/api/bids", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        block_id: Number(id),
        trade_id: currentUser.id,
        price: Number(bidPrice),
        start_date: bidStartDate || null,
        duration_days: bidDuration ? Number(bidDuration) : null,
        description: bidDescription,
        license_info: bidLicense,
        insurance_info: bidInsurance,
        is_revision: isRevision ? 1 : 0,
        original_bid_id: isRevision && existingBid ? existingBid.id : null,
        revision_reason: revisionReason || null,
      }),
    });

    setShowBidForm(false);
    setBidPrice("");
    setBidStartDate("");
    setBidDuration("");
    setBidDescription("");
    setRevisionReason("");
    setIsRevision(false);
    setSubmitting(false);
    fetchBlock();
  };

  const startEditBid = (bid: Bid) => {
    setEditingBidId(bid.id);
    setEditPrice(String(bid.price));
    setEditStartDate(bid.start_date || "");
    setEditDuration(bid.duration_days ? String(bid.duration_days) : "");
    setEditDescription(bid.description || "");
  };

  const saveEditBid = async (bidId: number) => {
    setSubmitting(true);
    await fetch(`/api/bids/${bidId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        price: Number(editPrice),
        start_date: editStartDate || null,
        duration_days: editDuration ? Number(editDuration) : null,
        description: editDescription,
      }),
    });
    setEditingBidId(null);
    setSubmitting(false);
    fetchBlock();
  };

  const confirmSchedule = async (bidId: number) => {
    setSubmitting(true);
    await fetch(`/api/bids/${bidId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delay_confirmed: true }),
    });
    setSubmitting(false);
    fetchBlock();
    refreshNotifications();
  };

  const submitProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSubmitting(true);

    await fetch(`/api/blocks/${id}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        trade_id: currentUser.id,
        status: progressStatus,
        notes: progressNotes,
        new_estimated_completion: progressEstDate || null,
      }),
    });

    setShowProgressForm(false);
    setProgressNotes("");
    setProgressEstDate("");
    setProgressStatus("in_progress");
    setSubmitting(false);
    fetchBlock();
    refreshNotifications();
  };

  if (loading || !block || !currentUser) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Loading...</p></div>;
  }

  const bids = block.bids || [];
  const progressUpdates = block.progress_updates || [];
  const myBids = bids.filter((b) => b.trade_id === currentUser.id);
  const myAcceptedBid = myBids.find((b) => b.status === "accepted");
  const myNeedsConfirmation = myBids.filter((b) => b.status === "needs_confirmation");
  const isAssignedTrade = !!myAcceptedBid;
  const canBid = block.status === "open_for_bids" || block.status === "awarded";
  const canUpdateProgress = isAssignedTrade && (block.status === "awarded" || block.status === "in_progress" || block.status === "delayed");

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <Link href="/trade/blocks" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back to Blocks
      </Link>

      {/* Block Header */}
      <div className="card mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{block.title}</h1>
              <StatusBadge status={block.status} />
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {block.project_title}
              </span>
              {block.trade_type ? (
                <span className="badge bg-accent-100 text-accent-700">{block.trade_type}</span>
              ) : null}
            </div>
          </div>
        </div>

        {block.description && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-400 uppercase mb-1">Description</p>
            <p className="text-sm text-gray-700">{block.description}</p>
          </div>
        )}

        {block.special_requirements && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-400 uppercase mb-1">Special Requirements</p>
            <p className="text-sm text-gray-700">{block.special_requirements}</p>
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase">Target Date</p>
            <p className="mt-0.5 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-gray-400" />
              {block.desired_completion_date || "Not set"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase">Estimated Completion</p>
            <p className={`mt-0.5 flex items-center gap-1.5 ${block.status === "delayed" ? "text-red-600" : ""}`}>
              <Clock className="w-4 h-4" />
              {block.estimated_completion_date || "TBD"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase">Current Bids</p>
            <p className="mt-0.5">{bids.length} bid{bids.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {/* Dependencies */}
        {block.dependency_blocks?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase mb-2">Dependencies</p>
            <div className="flex flex-wrap gap-2">
              {block.dependency_blocks.map((dep) => (
                <span key={dep.id} className="inline-flex items-center gap-1.5 text-sm bg-gray-50 border rounded-lg px-3 py-1.5">
                  {dep.status === "completed" ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : dep.status === "delayed" ? (
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  ) : (
                    <Clock className="w-4 h-4 text-gray-400" />
                  )}
                  {dep.title}
                  <StatusBadge status={dep.status} />
                </span>
              ))}
            </div>
            {!block.depends_on_completed && (
              <p className="text-sm text-amber-600 mt-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Upstream blocks are not yet complete. Work cannot begin until they finish, and timelines may shift.
              </p>
            )}
          </div>
        )}

        {/* Downstream blocks */}
        {block.downstream_blocks?.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase mb-2">Downstream Blocks (depend on this)</p>
            <div className="flex flex-wrap gap-2">
              {block.downstream_blocks.map((ds) => (
                <span key={ds.id} className="inline-flex items-center gap-1.5 text-sm bg-gray-50 border rounded-lg px-3 py-1.5">
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                  {ds.title}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        {canBid && (
          <button
            onClick={() => { setShowBidForm(true); setIsRevision(false); }}
            className="btn-primary flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Submit Bid
          </button>
        )}
        {canBid && myBids.length > 0 && (
          <button
            onClick={() => { setShowBidForm(true); setIsRevision(true); }}
            className="btn-accent flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Submit Revised Bid
          </button>
        )}
        {canUpdateProgress && (
          <button
            onClick={() => setShowProgressForm(true)}
            className="btn-primary flex items-center gap-2"
          >
            <ClipboardEdit className="w-4 h-4" />
            Update Progress
          </button>
        )}
      </div>

      {/* Bid Form */}
      {showBidForm && (
        <div className="card mb-6 border-2 border-primary-200">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Send className="w-4 h-4 text-primary-600" />
            {isRevision ? "Submit Revised Bid" : "Submit Bid"}
          </h2>
          <form onSubmit={submitBid}>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Price ($) *</label>
                <input className="input" type="number" value={bidPrice} onChange={(e) => setBidPrice(e.target.value)} required min="1" placeholder="e.g., 2500" />
              </div>
              <div>
                <label className="label">Proposed Start Date</label>
                <input className="input" type="date" value={bidStartDate} onChange={(e) => setBidStartDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Duration (days)</label>
                <input className="input" type="number" value={bidDuration} onChange={(e) => setBidDuration(e.target.value)} min="1" placeholder="e.g., 5" />
              </div>
              <div>
                <label className="label">License Info</label>
                <input className="input" value={bidLicense} onChange={(e) => setBidLicense(e.target.value)} placeholder="License number" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Approach / Description</label>
                <textarea className="input" rows={3} value={bidDescription} onChange={(e) => setBidDescription(e.target.value)} placeholder="Describe your approach to this work..." />
              </div>
              <div>
                <label className="label">Insurance Info</label>
                <input className="input" value={bidInsurance} onChange={(e) => setBidInsurance(e.target.value)} placeholder="Insurance details" />
              </div>
              {isRevision && (
                <div>
                  <label className="label">Reason for Revision</label>
                  <input className="input" value={revisionReason} onChange={(e) => setRevisionReason(e.target.value)} placeholder="e.g., Timeline shifted due to upstream delay" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "Submitting..." : isRevision ? "Submit Revised Bid" : "Submit Bid"}
              </button>
              <button type="button" onClick={() => setShowBidForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Progress Form */}
      {showProgressForm && (
        <div className="card mb-6 border-2 border-primary-200">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <ClipboardEdit className="w-4 h-4 text-primary-600" />
            Update Progress
          </h2>
          <form onSubmit={submitProgress}>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Status *</label>
                <select className="input" value={progressStatus} onChange={(e) => setProgressStatus(e.target.value)}>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="delayed">Delayed</option>
                </select>
              </div>
              {progressStatus === "delayed" && (
                <div>
                  <label className="label">New Estimated Completion Date</label>
                  <input className="input" type="date" value={progressEstDate} onChange={(e) => setProgressEstDate(e.target.value)} />
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="label">Notes</label>
                <textarea className="input" rows={3} value={progressNotes} onChange={(e) => setProgressNotes(e.target.value)} placeholder="Describe current progress, any issues, etc..." />
              </div>
            </div>
            {progressStatus === "delayed" && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Marking as delayed will automatically notify downstream trades and the project owner.
                </p>
              </div>
            )}
            <div className="flex items-center gap-3 mt-4">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "Updating..." : "Update Progress"}
              </button>
              <button type="button" onClick={() => setShowProgressForm(false)} className="btn-secondary">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Delay Confirmation Banner */}
      {myNeedsConfirmation.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-300 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800">Schedule Confirmation Required</h3>
              <p className="text-sm text-amber-700 mt-1">
                An upstream block has been delayed. Please confirm you can still work with the updated schedule, or revise your bid with new terms.
              </p>
              {myNeedsConfirmation.map((bid) => (
                <div key={bid.id} className="mt-3 p-3 bg-white rounded-lg border border-amber-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={bid.status} />
                      <span className="text-sm font-medium">${bid.price.toLocaleString()}</span>
                    </div>
                  </div>
                  {bid.start_date && <p className="text-xs text-gray-500">Start: {bid.start_date} | Duration: {bid.duration_days || "?"} days</p>}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => confirmSchedule(bid.id)}
                      disabled={submitting}
                      className="btn-primary btn-sm flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {submitting ? "Confirming..." : "Confirm Schedule"}
                    </button>
                    <button
                      onClick={() => startEditBid(bid)}
                      className="btn-secondary btn-sm flex items-center gap-1.5"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Revise Bid
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* My Bids */}
      {myBids.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Your Bids</h2>
          <div className="space-y-2">
            {myBids.map((bid) => (
              <div
                key={bid.id}
                className={`card !p-4 ${
                  bid.status === "accepted" ? "border-green-300 bg-green-50" :
                  bid.status === "needs_confirmation" ? "border-amber-300 bg-amber-50" : ""
                }`}
              >
                {editingBidId === bid.id ? (
                  /* Inline Edit Form */
                  <div>
                    <h3 className="text-sm font-semibold text-primary-600 mb-3 flex items-center gap-1.5">
                      <Pencil className="w-3.5 h-3.5" />
                      Edit Bid
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="label">Price ($) *</label>
                        <input className="input" type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} required min="1" />
                      </div>
                      <div>
                        <label className="label">Proposed Start Date</label>
                        <input className="input" type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} />
                      </div>
                      <div>
                        <label className="label">Duration (days)</label>
                        <input className="input" type="number" value={editDuration} onChange={(e) => setEditDuration(e.target.value)} min="1" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="label">Description</label>
                        <textarea className="input" rows={2} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <button onClick={() => saveEditBid(bid.id)} disabled={submitting} className="btn-primary btn-sm">
                        {submitting ? "Saving..." : "Save Changes"}
                      </button>
                      <button onClick={() => setEditingBidId(null)} className="btn-secondary btn-sm">Cancel</button>
                    </div>
                  </div>
                ) : (
                  /* Normal Bid Display */
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={bid.status} />
                        {bid.is_revision ? (
                          <span className="badge bg-orange-100 text-orange-700">Revised</span>
                        ) : null}
                        {bid.delay_confirmed ? (
                          <span className="badge bg-green-100 text-green-700">Schedule Confirmed</span>
                        ) : null}
                        <span className="text-xs text-gray-400">{new Date(bid.created_at).toLocaleDateString()}</span>
                      </div>
                      {bid.description && <p className="text-sm text-gray-600 mt-1">{bid.description}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        {bid.start_date && <span>Start: {bid.start_date}</span>}
                        {bid.duration_days && <span>Duration: {bid.duration_days} days</span>}
                      </div>
                      {(bid.status === "pending" || bid.status === "needs_confirmation") && (
                        <button
                          onClick={() => startEditBid(bid)}
                          className="mt-2 text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit Bid
                        </button>
                      )}
                    </div>
                    <p className="text-xl font-bold">${bid.price.toLocaleString()}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Bids (visible to trade for transparency) */}
      {bids.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">All Bids ({bids.length})</h2>
          <div className="space-y-2">
            {bids.map((bid) => (
              <div key={bid.id} className="card !p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{bid.trade_name}</span>
                      <span className="text-xs text-gray-400">{bid.trade_type}</span>
                      {bid.trade_rating && bid.trade_rating > 0 && (
                        <span className="text-xs text-yellow-600">{bid.trade_rating} ★</span>
                      )}
                      <StatusBadge status={bid.status} />
                      {bid.is_revision ? (
                        <span className="badge bg-orange-100 text-orange-700">Revised</span>
                      ) : null}
                    </div>
                  </div>
                  <p className="font-bold">${bid.price.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress History */}
      {progressUpdates.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Progress History</h2>
          <div className="space-y-2">
            {progressUpdates.map((update) => (
              <div key={update.id} className="card !p-4">
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
  );
}
