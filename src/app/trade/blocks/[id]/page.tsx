"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import { useApp } from "@/lib/context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { ScheduleTimeline, TimelineRow } from "@/components/ScheduleTimeline";
import { Attachments } from "@/components/Attachments";
import { Bid, Block, ProgressUpdate } from "@/lib/types";
import {
  ScheduledBlock, bidFinish, checkBidSchedule, daysBetween, downstreamClosure, expectedFinish, expectedStart, targetWindow,
} from "@/lib/schedule";
import {
  ArrowLeft, MapPin, Calendar, Clock, CheckCircle2, ChevronLeft, ChevronRight, Layers,
  AlertTriangle, Send, ArrowRight, ClipboardEdit, Pencil, CalendarCheck
} from "lucide-react";

type DepBlock = ScheduledBlock;

interface BlockDetail {
  id: number;
  title: string;
  status: string;
  description: string | null;
  trade_type: string | null;
  special_requirements: string | null;
  pending_delay_days: number | null;
  delay_baseline_date: string | null;
  desired_start_date: string | null;
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
  bid_count: number;
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
  // Set when the form is revising an existing bid rather than creating one
  const [revisingBidId, setRevisingBidId] = useState<number | null>(null);
  const [revisionReason, setRevisionReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Progress form
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [progressStatus, setProgressStatus] = useState("in_progress");
  const [progressNotes, setProgressNotes] = useState("");
  const [progressEstDate, setProgressEstDate] = useState("");

  const [projectBlocks, setProjectBlocks] = useState<Block[]>([]);
  // Reporting a delay takes a confirmation step
  const [confirmingDelay, setConfirmingDelay] = useState(false);
  // A downstream trade proposing dates they can make instead of the shifted ones
  const [proposingBidId, setProposingBidId] = useState<number | null>(null);
  const [proposeStart, setProposeStart] = useState("");
  const [proposeDuration, setProposeDuration] = useState("");
  const [proposeReason, setProposeReason] = useState("");
  const [proposeError, setProposeError] = useState("");
  const [justSubmitted, setJustSubmitted] = useState<string | null>(null);

  const fetchBlock = useCallback(() => {
    fetch(`/api/blocks/${id}`).then((r) => r.json()).then((data) => {
      setBlock(data);
      setLoading(false);
      // The rest of the project, so the trade can move through it without leaving this page
      if (data?.project_id) {
        fetch(`/api/blocks?project_id=${data.project_id}`)
          .then((r) => (r.ok ? r.json() : []))
          .then(setProjectBlocks)
          .catch(() => {});
      }
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

  // Moving to another block in the project starts fresh
  useEffect(() => {
    setJustSubmitted(null);
    setShowBidForm(false);
    setShowProgressForm(false);
    setConfirmingDelay(false);
    setProposingBidId(null);
    setRevisingBidId(null);
  }, [id]);

  // Fill the bid's dates with the owner's target window
  const matchOwnerSchedule = () => {
    if (!block) return;
    const target = targetWindow(block, block.dependency_blocks || []);
    if (target.start) setBidStartDate(target.start);
    if (target.duration) setBidDuration(String(target.duration));
  };

  const openNewBidForm = () => {
    const target = block ? targetWindow(block, block.dependency_blocks || []) : null;
    setRevisingBidId(null);
    setBidPrice("");
    setBidStartDate(target?.start || "");
    setBidDuration(target?.duration ? String(target.duration) : "");
    setBidDescription("");
    setRevisionReason("");
    setBidLicense(currentUser?.license_info || "");
    setBidInsurance(currentUser?.insurance_info || "");
    setShowBidForm(true);
  };

  const openReviseBidForm = (bid: Bid) => {
    setRevisingBidId(bid.id);
    setBidPrice(String(bid.price));
    setBidStartDate(bid.start_date || "");
    setBidDuration(bid.duration_days ? String(bid.duration_days) : "");
    setBidDescription(bid.description || "");
    setBidLicense(bid.license_info || "");
    setBidInsurance(bid.insurance_info || "");
    setRevisionReason(bid.revision_reason || "");
    setShowBidForm(true);
  };

  const submitBid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSubmitting(true);

    const terms = {
      price: Number(bidPrice),
      start_date: bidStartDate || null,
      duration_days: bidDuration ? Number(bidDuration) : null,
      description: bidDescription,
      license_info: bidLicense,
      insurance_info: bidInsurance,
    };

    // A revision edits the existing bid in place instead of creating a new one
    const res = revisingBidId
      ? await fetch(`/api/bids/${revisingBidId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...terms, revision_reason: revisionReason || null }),
        })
      : await fetch("/api/bids", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...terms, block_id: Number(id) }),
        });
    if (res.ok) {
      setJustSubmitted(revisingBidId ? "Bid updated" : "Bid submitted");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    setShowBidForm(false);
    setRevisingBidId(null);
    setRevisionReason("");
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

  const startProposal = (bid: Bid) => {
    setProposingBidId(bid.id);
    setProposeStart(bid.start_date || "");
    setProposeDuration(bid.duration_days ? String(bid.duration_days) : "");
    setProposeReason("");
    setProposeError("");
  };

  const submitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposingBidId) return;
    setSubmitting(true);
    setProposeError("");
    const res = await fetch(`/api/bids/${proposingBidId}/propose`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start_date: proposeStart, duration_days: Number(proposeDuration), reason: proposeReason }),
    });
    setSubmitting(false);
    if (!res.ok) {
      setProposeError((await res.json().catch(() => ({}))).error || "Could not send your dates");
      return;
    }
    setProposingBidId(null);
    fetchBlock();
    refreshNotifications();
  };

  const submitProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    // A delay is only sent once the trade has reviewed what it affects
    if (progressStatus === "delayed" && !confirmingDelay) {
      setConfirmingDelay(true);
      return;
    }
    setConfirmingDelay(false);
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
  const myOpenBid = myBids.find((b) => b.status === "pending" || b.status === "needs_confirmation");
  const isAssignedTrade = !!myAcceptedBid;
  const canBid = block.status === "open_for_bids" || block.status === "awarded";
  const canUpdateProgress = isAssignedTrade && (block.status === "awarded" || block.status === "in_progress" || block.status === "delayed");

  // What a reported delay is measured against, and which later blocks it would move
  const delayBaseline =
    block.delay_baseline_date?.slice(0, 10) ||
    block.estimated_completion_date?.slice(0, 10) ||
    (myAcceptedBid ? bidFinish(myAcceptedBid.start_date, myAcceptedBid.duration_days) : null) ||
    block.desired_completion_date?.slice(0, 10) ||
    null;
  const delayAffects = downstreamClosure(block.id, projectBlocks)
    .map((dsId) => projectBlocks.find((b) => b.id === dsId))
    .filter((b): b is Block => !!b && b.status !== "completed");

  // Schedule: the owner's target leads; the trade's dates (live from the form while it's open) are checked against it.
  const upstream = block.dependency_blocks || [];
  const downstream = block.downstream_blocks || [];
  const target = targetWindow(block, upstream);
  const referenceBid = myOpenBid || myAcceptedBid;
  const proposalStart = showBidForm ? bidStartDate : referenceBid?.start_date || "";
  const proposalDuration = showBidForm ? Number(bidDuration) || null : referenceBid?.duration_days || null;
  const scheduleCheck = checkBidSchedule(block, upstream, downstream, proposalStart, proposalDuration);
  const timelineRows: TimelineRow[] = [
    ...upstream.map((b) => ({
      key: `up-${b.id}`, label: b.title, sublabel: `Upstream · ${b.status.replace(/_/g, " ")}`,
      kind: "upstream" as const, start: expectedStart(b), finish: expectedFinish(b),
    })),
    {
      key: "target", label: "Owner's target", sublabel: target.startIsDerived ? "Start follows upstream" : undefined,
      kind: "target", start: target.start, finish: target.finish,
    },
    ...(proposalStart
      ? [{
          key: "proposal", label: showBidForm ? "Your proposed dates" : "Your bid",
          kind: "proposal" as const, start: proposalStart, finish: bidFinish(proposalStart, proposalDuration),
          warn: scheduleCheck ? !scheduleCheck.ok : false,
        }]
      : []),
    ...downstream.map((b) => ({
      key: `down-${b.id}`, label: b.title, sublabel: `Downstream · ${b.status.replace(/_/g, " ")}`,
      kind: "downstream" as const, start: expectedStart(b), finish: expectedFinish(b),
    })),
  ];

  const scheduleFeedback = scheduleCheck && (
    scheduleCheck.ok ? (
      <p className="text-sm text-green-700 flex items-center gap-1.5">
        <CheckCircle2 className="w-4 h-4" />
        These dates fit the owner&apos;s schedule and the neighbouring blocks.
      </p>
    ) : (
      <ul className="text-sm text-amber-700 space-y-1">
        {scheduleCheck.issues.map((issue) => (
          <li key={issue} className="flex items-start gap-1.5">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {issue}
          </li>
        ))}
      </ul>
    )
  );

  // Moving through the project: blocks still open for bids (or with the trade's bid still in play), in project order
  const navBlocks = projectBlocks.filter((b) =>
    b.id === block.id || b.status === "open_for_bids" || b.my_bid_status === "pending" || b.my_bid_status === "needs_confirmation"
  );
  const navIndex = navBlocks.findIndex((b) => b.id === block.id);
  const prevBlock = navIndex > 0 ? navBlocks[navIndex - 1] : null;
  const nextBlock = navIndex >= 0 && navIndex < navBlocks.length - 1 ? navBlocks[navIndex + 1] : null;
  // After bidding, suggest the next open block without a bid, wrapping around to the start of the project
  const ordered = [...navBlocks.slice(navIndex + 1), ...navBlocks.slice(0, Math.max(navIndex, 0))];
  const nextToBid = ordered.find((b) => b.status === "open_for_bids" && !b.my_bid_id) || null;
  const remainingOpen = projectBlocks.filter((b) => b.id !== block.id && b.status === "open_for_bids" && !b.my_bid_id).length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 min-w-0">
          <Link href="/trade/blocks" className="inline-flex items-center gap-1 hover:text-gray-700 shrink-0">
            <ArrowLeft className="w-4 h-4" />
            Browse Blocks
          </Link>
          <span>/</span>
          <Link href={`/trade/projects/${block.project_id}`} className="hover:text-gray-700 truncate">
            {block.project_title}
          </Link>
        </nav>
        {navBlocks.length > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">
              {navIndex + 1} of {navBlocks.length} open in this project
            </span>
            {prevBlock ? (
              <Link href={`/trade/blocks/${prevBlock.id}`} className="btn-secondary btn-sm flex items-center gap-1" title={prevBlock.title}>
                <ChevronLeft className="w-4 h-4" /> Previous
              </Link>
            ) : null}
            {nextBlock ? (
              <Link href={`/trade/blocks/${nextBlock.id}`} className="btn-secondary btn-sm flex items-center gap-1" title={nextBlock.title}>
                Next <ChevronRight className="w-4 h-4" />
              </Link>
            ) : null}
          </div>
        )}
      </div>

      {justSubmitted && (
        <div className="mb-6 p-4 rounded-xl border border-green-200 bg-green-50 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-green-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {justSubmitted} for &ldquo;{block.title}&rdquo;.
            {remainingOpen > 0
              ? ` ${remainingOpen} more open block${remainingOpen !== 1 ? "s" : ""} in this project.`
              : " You've bid on every open block in this project."}
          </p>
          <div className="flex items-center gap-2">
            <Link href={`/trade/projects/${block.project_id}`} className="btn-secondary btn-sm">Whole project</Link>
            {nextToBid && (
              <Link href={`/trade/blocks/${nextToBid.id}`} className="btn-primary btn-sm flex items-center gap-1">
                Next: {nextToBid.title} <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Block Header */}
      <div className="card mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{block.title}</h1>
              <StatusBadge status={block.status} />
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <Link href={`/trade/projects/${block.project_id}`} className="flex items-center gap-1 hover:text-primary-600">
                <MapPin className="w-4 h-4" />
                {block.project_title}
                <span className="text-primary-600">· View whole project</span>
              </Link>
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
            <p className="text-xs font-medium text-gray-400 uppercase">Target Schedule</p>
            <p className="mt-0.5 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-gray-400" />
              {target.start || target.finish
                ? `${target.start || "?"} → ${target.finish || "?"}`
                : "Not set"}
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
            <p className="mt-0.5">{block.bid_count} bid{block.bid_count !== 1 ? "s" : ""}</p>
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

      <Attachments
        projectId={block.project_id}
        blockId={block.id}
        includeProjectFiles
        title="Plans, photos & specs"
        className="card mb-6"
      />

      {/* Schedule */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-1">
          <h2 className="font-semibold flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-primary-600" />
            Schedule
          </h2>
          {target.duration && (
            <span className="text-xs text-gray-500">Owner&apos;s window: {target.duration} day{target.duration !== 1 ? "s" : ""}</span>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {target.start || target.finish ? (
            <>
              The owner wants this block done {target.start ? <>from <strong>{target.start}</strong> </> : null}
              {target.finish ? <>by <strong>{target.finish}</strong></> : null}.
              {target.startIsDerived && target.latestUpstream && <> No start date was set, so the suggested start is the day after upstream work is expected to finish ({target.latestUpstream}).</>}
            </>
          ) : (
            "The owner hasn't set target dates for this block yet."
          )}
        </p>
        <ScheduleTimeline rows={timelineRows} />
        {scheduleFeedback && !showBidForm && <div className="mt-4 pt-4 border-t border-gray-100">{scheduleFeedback}</div>}
      </div>

      {isAssignedTrade && block.pending_delay_days != null && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            You reported a delay to {block.estimated_completion_date}. The owner is deciding whether to accept it and shift the
            downstream schedule, or reopen this block for bids.
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        {canBid && !myOpenBid && !myAcceptedBid && (
          <button onClick={openNewBidForm} className="btn-primary flex items-center gap-2">
            <Send className="w-4 h-4" />
            Submit Bid
          </button>
        )}
        {myOpenBid && (
          <button onClick={() => openReviseBidForm(myOpenBid)} className="btn-accent flex items-center gap-2">
            <Pencil className="w-4 h-4" />
            Revise Bid
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
            {revisingBidId ? "Revise Bid" : "Submit Bid"}
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
              <div className="sm:col-span-2 -mt-1 p-3 rounded-lg bg-gray-50 border border-gray-100 space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  {(target.start || target.duration) && (
                    <button type="button" onClick={matchOwnerSchedule} className="btn-secondary btn-sm flex items-center gap-1.5">
                      <CalendarCheck className="w-3.5 h-3.5" />
                      Match owner&apos;s schedule
                    </button>
                  )}
                  {bidStartDate && bidDuration && (
                    <span className="text-xs text-gray-500">
                      Your dates: {bidStartDate} → {bidFinish(bidStartDate, Number(bidDuration))}
                    </span>
                  )}
                </div>
                {scheduleFeedback || <p className="text-xs text-gray-500">Enter a start date and duration to check them against the schedule above.</p>}
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
              {revisingBidId && (
                <div>
                  <label className="label">Reason for Revision</label>
                  <input className="input" value={revisionReason} onChange={(e) => setRevisionReason(e.target.value)} placeholder="e.g., Timeline shifted due to upstream delay" />
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "Saving..." : revisingBidId ? "Save Revised Bid" : "Submit Bid"}
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
                <select className="input" value={progressStatus} onChange={(e) => { setProgressStatus(e.target.value); setConfirmingDelay(false); }}>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="delayed">Delayed</option>
                </select>
              </div>
              {progressStatus === "delayed" && (
                <div>
                  <label className="label">New Estimated Completion Date *</label>
                  <input className="input" type="date" value={progressEstDate} onChange={(e) => { setProgressEstDate(e.target.value); setConfirmingDelay(false); }} required />
                </div>
              )}
              <div className="sm:col-span-2">
                <label className="label">Notes</label>
                <textarea className="input" rows={3} value={progressNotes} onChange={(e) => setProgressNotes(e.target.value)} placeholder="Describe current progress, any issues, etc..." />
              </div>
            </div>
            {progressStatus === "delayed" && !confirmingDelay && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  You&apos;ll review and confirm the delay before it&apos;s sent to the project owner.
                </p>
              </div>
            )}
            {progressStatus === "delayed" && confirmingDelay && (
              <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-900 space-y-2">
                <p className="font-semibold">Confirm this delay</p>
                <p>
                  &ldquo;{block.title}&rdquo; will finish <strong>{progressEstDate}</strong>
                  {delayBaseline && <> instead of {delayBaseline}</>}
                  {delayBaseline && progressEstDate && daysBetween(delayBaseline, progressEstDate) > 0 && (
                    <> &mdash; <strong>{daysBetween(delayBaseline, progressEstDate)} days late</strong></>
                  )}.
                </p>
                {delayAffects.length > 0 ? (
                  <p>
                    If the owner accepts it, {delayAffects.length} later block{delayAffects.length !== 1 ? "s" : ""} move
                    {delayAffects.length === 1 ? "s" : ""} and their trades are asked to reconfirm: {delayAffects.map((b) => b.title).join(", ")}.
                  </p>
                ) : (
                  <p>No later blocks depend on this one.</p>
                )}
                <p>The owner can also reopen this block for bids instead.</p>
              </div>
            )}
            <div className="flex items-center gap-3 mt-4">
              <button type="submit" disabled={submitting} className={confirmingDelay ? "btn-danger" : "btn-primary"}>
                {submitting ? "Updating..." : confirmingDelay ? "Confirm delay" : progressStatus === "delayed" ? "Review delay" : "Update Progress"}
              </button>
              <button
                type="button"
                onClick={() => (confirmingDelay ? setConfirmingDelay(false) : setShowProgressForm(false))}
                className="btn-secondary"
              >
                {confirmingDelay ? "Back" : "Cancel"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Shifted dates waiting on this trade */}
      {myNeedsConfirmation.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-300 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              {block.pending_delay_days != null ? (
                <>
                  <h3 className="font-semibold text-amber-800">Waiting for the owner</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    You proposed finishing on {block.estimated_completion_date}. The owner will accept your dates or reopen this block for bids.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="font-semibold text-amber-800">Can you make the new dates?</h3>
                  <p className="text-sm text-amber-700 mt-1">
                    An earlier block was delayed and the owner moved your dates to match. Confirm you can make them, or tell the owner the dates you can make.
                  </p>
                </>
              )}
              {myNeedsConfirmation.map((bid) => (
                <div key={bid.id} className="mt-3 p-3 bg-white rounded-lg border border-amber-200">
                  <p className="text-sm text-gray-800">
                    New dates: <strong>{bid.start_date || "?"} → {bidFinish(bid.start_date, bid.duration_days) || "?"}</strong>
                    <span className="text-gray-500"> ({bid.duration_days || "?"} days) &middot; ${bid.price.toLocaleString()}</span>
                  </p>
                  {block.pending_delay_days == null && proposingBidId !== bid.id && (
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <button
                        onClick={() => confirmSchedule(bid.id)}
                        disabled={submitting}
                        className="btn-primary btn-sm flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {submitting ? "Confirming..." : "I can make these dates"}
                      </button>
                      <button onClick={() => startProposal(bid)} className="btn-secondary btn-sm flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        I can&apos;t make these dates
                      </button>
                    </div>
                  )}
                  {proposingBidId === bid.id && (
                    <form onSubmit={submitProposal} className="mt-3 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Start you can make *</label>
                          <input className="input" type="date" value={proposeStart} onChange={(e) => setProposeStart(e.target.value)} required />
                        </div>
                        <div>
                          <label className="label">Days *</label>
                          <input className="input" type="number" min="1" value={proposeDuration} onChange={(e) => setProposeDuration(e.target.value)} required />
                        </div>
                      </div>
                      <input
                        className="input"
                        value={proposeReason}
                        onChange={(e) => setProposeReason(e.target.value)}
                        placeholder="Why (e.g., crew booked on another job until then)"
                      />
                      {proposeStart && Number(proposeDuration) > 0 && (
                        <p className="text-xs text-gray-600">
                          You&apos;d finish {bidFinish(proposeStart, Number(proposeDuration))}. The owner decides whether to accept this
                          (moving any later blocks) or reopen this block for bids.
                        </p>
                      )}
                      {proposeError && <p className="text-xs text-red-600">{proposeError}</p>}
                      <div className="flex items-center gap-2">
                        <button type="submit" disabled={submitting} className="btn-primary btn-sm">
                          {submitting ? "Sending..." : "Send my dates to the owner"}
                        </button>
                        <button type="button" onClick={() => setProposingBidId(null)} className="btn-secondary btn-sm">Cancel</button>
                      </div>
                    </form>
                  )}
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
                        onClick={() => openReviseBidForm(bid)}
                        className="mt-2 text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        Revise Bid
                      </button>
                    )}
                  </div>
                  <p className="text-xl font-bold">${bid.price.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* The rest of the project */}
      {projectBlocks.length > 1 && (
        <div className="card mb-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary-600" />
              In this project
            </h2>
            <Link href={`/trade/projects/${block.project_id}`} className="text-sm text-primary-600 hover:underline">
              Bid on several at once
            </Link>
          </div>
          <ul className="divide-y divide-gray-100">
            {projectBlocks.map((b) => {
              const isCurrent = b.id === block.id;
              return (
                <li key={b.id}>
                  <Link
                    href={`/trade/blocks/${b.id}`}
                    className={`flex flex-wrap items-center justify-between gap-2 py-2 px-2 -mx-2 rounded-lg ${isCurrent ? "bg-primary-50" : "hover:bg-gray-50"}`}
                  >
                    <span className={`text-sm ${isCurrent ? "font-semibold text-primary-700" : "text-gray-800"}`}>
                      {b.title}
                      {b.trade_type && <span className="text-xs text-gray-400 ml-2">{b.trade_type}</span>}
                    </span>
                    <span className="flex items-center gap-2">
                      {b.my_bid_id && b.my_bid_status ? (
                        <span className="text-xs text-primary-700 flex items-center gap-1">
                          You bid {b.my_bid_price != null ? `$${b.my_bid_price.toLocaleString()}` : ""} <StatusBadge status={b.my_bid_status} />
                        </span>
                      ) : (
                        <StatusBadge status={b.status} />
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
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
