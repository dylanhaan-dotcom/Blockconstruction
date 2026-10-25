"use client";

import React, { useEffect, useState, useCallback, use } from "react";
import { useApp } from "@/lib/context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { TRADE_TYPES } from "@/lib/trades";
import { ScheduledBlock, addDays, bidFinish, checkBidSchedule, daysBetween, downstreamClosure, expectedFinish } from "@/lib/schedule";
import { GanttChart } from "@/components/GanttChart";
import { DurationHint } from "@/components/DurationHint";
import { Attachments } from "@/components/Attachments";
import { alignToDependencies, earliestStart, suggestSchedule } from "@/lib/durations";
import { Scale, projectScale } from "@/lib/benchmarks";
import { Block, Bid, Project, Appreciation, ProgressUpdate } from "@/lib/types";
import {
  ArrowLeft, ChevronDown, ChevronUp, DollarSign, Heart,
  Clock, CheckCircle2, AlertTriangle, ArrowRight, Coffee, UtensilsCrossed, X,
  Share2, Clipboard, Settings, BarChart3, Pencil
} from "lucide-react";

type TabView = "timeline" | "gantt" | "blocks";

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { currentUser, loading: sessionLoading, refreshNotifications } = useApp();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [expandedBlock, setExpandedBlock] = useState<number | null>(null);
  const [blockDetail, setBlockDetail] = useState<Record<string, unknown> | null>(null);
  const [appreciations, setAppreciations] = useState<Appreciation[]>([]);
  const [projectBids, setProjectBids] = useState<Bid[]>([]);
  const [showAppreciationModal, setShowAppreciationModal] = useState<{ tradeId: number; tradeName: string; blockId?: number } | null>(null);
  const [appreciationType, setAppreciationType] = useState<string>("coffee");
  const [customAmount, setCustomAmount] = useState("");
  const [appreciationMessage, setAppreciationMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabView>("timeline");
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduling, setScheduling] = useState(false);

  const fetchData = useCallback(() => {
    if (!id) return;
    Promise.all([
      fetch(`/api/projects/${id}`).then((r) => r.json()),
      fetch(`/api/blocks?project_id=${id}`).then((r) => r.json()),
      fetch(`/api/appreciation?from_user_id=${currentUser?.id}`).then((r) => r.json()),
      fetch(`/api/bids?project_id=${id}`).then((r) => (r.ok ? r.json() : [])),
    ]).then(([p, b, a, bids]) => {
      // Owners can only manage their own projects
      if (!p || p.error || Number(p.owner_id) !== currentUser?.id) {
        router.push("/owner");
        return;
      }
      setProject(p);
      setBlocks(b);
      setAppreciations(a);
      setProjectBids(bids);
      setLoading(false);
    });
  }, [id, currentUser?.id, router]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!currentUser || currentUser.role !== "project_owner") {
      router.push("/");
      return;
    }
    fetchData();
  }, [currentUser, sessionLoading, router, fetchData]);

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

  const reopenBidding = async (bidId: number) => {
    await fetch(`/api/bids/${bidId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "pending" }),
    });
    fetchData();
    if (expandedBlock) fetchBlockDetail(expandedBlock);
    refreshNotifications();
  };

  // Fill empty target dates on unfinished blocks from typical durations and dependencies
  const applySuggestedSchedule = async () => {
    if (!scheduleStart) return;
    setScheduling(true);
    const indexById = new Map(blocks.map((b, i) => [b.id, i]));
    const scale = projectScale(project?.project_type, project?.title);
    const schedulable = blocks.map((b) => ({
        title: b.title,
        trade_type: b.trade_type,
        depends_on: (b.dependencies || []).map((d) => indexById.get(d)).filter((i): i is number => i !== undefined),
        start: b.desired_start_date,
        finish: b.desired_completion_date || b.actual_completion_date?.slice(0, 10) || null,
      }));
    const filled = suggestSchedule(schedulable, scheduleStart, scale);
    // Then move any block that would start before its dependencies finish
    const suggested = alignToDependencies(
      schedulable.map((b, i) => ({ ...b, start: filled[i].start, finish: filled[i].finish })),
      scale
    ).map((d, i) => ({ start: d.start || filled[i].start, finish: d.finish || filled[i].finish }));
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.status === "completed") continue;
      if (b.desired_start_date === suggested[i].start && b.desired_completion_date === suggested[i].finish) continue;
      await fetch(`/api/blocks/${b.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ desired_start_date: suggested[i].start, desired_completion_date: suggested[i].finish }),
      });
    }
    setScheduling(false);
    fetchData();
  };

  const decideDelay = async (block: Block, action: "shift" | "reopen") => {
    if (action === "reopen" && !window.confirm(`Reopen "${block.title}" for bids? The current trade's bid goes back to pending and downstream dates stay as they are.`)) return;
    await fetch(`/api/blocks/${block.id}/delay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    fetchData();
    if (expandedBlock) fetchBlockDetail(expandedBlock);
    refreshNotifications();
  };

  const toggleParallelBidding = async () => {
    if (!project) return;
    const newValue = project.allow_parallel_bidding ? 0 : 1;
    await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allow_parallel_bidding: newValue }),
    });
    fetchData();
  };

  const saveBlockEdit = async (blockId: number, updates: Record<string, unknown>, reopenBids?: boolean) => {
    await fetch(`/api/blocks/${blockId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...updates, reopen_bids: reopenBids }),
    });
    fetchData();
    fetchBlockDetail(blockId);
  };

  const generateShareLink = async () => {
    await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generate_share_token: true }),
    });
    fetchData();
  };

  const copyShareLink = () => {
    if (!project?.share_token) return;
    const url = `${window.location.origin}/share/${project.share_token}`;
    navigator.clipboard.writeText(url).then(() => {
      setShareLinkCopied(true);
      setTimeout(() => setShareLinkCopied(false), 2000);
    });
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

  const tabs: { key: TabView; label: string; icon: React.ReactNode }[] = [
    { key: "timeline", label: "Timeline", icon: <Clock className="w-4 h-4" /> },
    { key: "gantt", label: "Gantt Chart", icon: <BarChart3 className="w-4 h-4" /> },
    { key: "blocks", label: "Blocks", icon: <ChevronDown className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <Link href="/owner" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
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
        <Attachments
          projectId={project.id}
          blockId={null}
          canEdit
          title="Project files"
          emptyText="Add plans, photos, or specs that every trade bidding on this project should see. Up to 4 MB per file."
          className="mt-4 pt-4 border-t border-gray-100"
        />
      </div>

      {/* Delays waiting for the owner's decision */}
      {blocks.filter((b) => b.pending_delay_days != null).map((delayed) => {
        const days = delayed.pending_delay_days || 0;
        const affected = downstreamClosure(delayed.id, blocks)
          .map((dsId) => blocks.find((b) => b.id === dsId))
          .filter((b): b is Block => !!b && b.status !== "completed");
        const shift = (d: string | null | undefined) => (d ? addDays(d.slice(0, 10), days) : null);
        const window = (start: string | null, finish: string | null) =>
          start && finish ? `${start} → ${finish}` : finish ? `by ${finish}` : start ? `from ${start}` : "no dates set";
        return (
          <div key={delayed.id} className="mb-6 p-4 rounded-xl border-2 border-red-200 bg-red-50">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold text-red-800">Delay needs your decision: {delayed.title}</h2>
                <p className="text-sm text-red-700 mt-1">
                  {delayed.awarded_trade ? `${delayed.awarded_trade} now expects` : "Now expected"} to finish{" "}
                  <strong>{delayed.estimated_completion_date}</strong>
                  {delayed.delay_baseline_date && <> instead of {delayed.delay_baseline_date}</>}
                  {days > 0 && <> &mdash; <strong>{days} day{days !== 1 ? "s" : ""} late</strong></>}.
                </p>
                {affected.length > 0 ? (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-red-800 uppercase mb-1">
                      Accepting moves {affected.length} downstream block{affected.length !== 1 ? "s" : ""} by {days} day{days !== 1 ? "s" : ""}
                    </p>
                    <ul className="text-sm text-gray-700 space-y-0.5">
                      {affected.map((b) => (
                        <li key={b.id} className="flex flex-wrap gap-x-2">
                          <span className="font-medium">{b.title}</span>
                          <span className="text-gray-500">
                            {window(b.desired_start_date, b.desired_completion_date)}
                            {days > 0 && (b.desired_start_date || b.desired_completion_date) && (
                              <> &nbsp;⟶&nbsp; <span className="text-red-700">{window(shift(b.desired_start_date), shift(b.desired_completion_date))}</span></>
                            )}
                          </span>
                          {b.awarded_trade && <span className="text-xs text-gray-500">({b.awarded_trade} will be asked to confirm)</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600 mt-2">No unfinished blocks depend on this one.</p>
                )}
                <div className="flex flex-wrap gap-2 mt-4">
                  <button onClick={() => decideDelay(delayed, "shift")} className="btn-primary btn-sm">
                    {affected.length > 0 && days > 0 ? `Accept delay & shift ${affected.length} block${affected.length !== 1 ? "s" : ""}` : "Accept delay"}
                  </button>
                  {delayed.status !== "completed" && (
                    <button onClick={() => decideDelay(delayed, "reopen")} className="btn-secondary btn-sm">
                      Reopen for bids to stay on schedule
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Project Settings */}
      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold">Project Settings</h2>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!project.allow_parallel_bidding}
              onChange={toggleParallelBidding}
              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">Allow Parallel Bidding</span>
          </label>
          <p className="text-xs text-gray-500">
            Dependencies govern when work can start, not when bidding opens. Open individual blocks for bids from the Blocks tab.
          </p>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-sm font-medium text-gray-700 mb-2">Suggest a schedule</p>
          <div className="flex flex-wrap items-center gap-3">
            <input
              className="input !w-auto"
              type="date"
              value={scheduleStart}
              onChange={(e) => setScheduleStart(e.target.value)}
              aria-label="Project start date"
            />
            <button
              onClick={applySuggestedSchedule}
              disabled={!scheduleStart || scheduling}
              className="btn-secondary btn-sm"
            >
              {scheduling ? "Updating dates..." : "Fill & align target dates"}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Fills empty dates with typical job lengths from published benchmarks, starting from this date, and moves any block
            that would start before its dependencies finish. Other dates you&apos;ve set are kept.
          </p>
        </div>
      </div>

      {/* Share Project */}
      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Share2 className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold">Share Project</h2>
        </div>
        {project.share_token ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-400 uppercase mb-1">Share URL</p>
              <div className="flex items-center gap-2">
                <code className="text-sm text-gray-700 bg-gray-100 rounded px-3 py-1.5 truncate block flex-1">
                  {typeof window !== "undefined"
                    ? `${window.location.origin}/share/${project.share_token}`
                    : `/share/${project.share_token}`}
                </code>
                <button
                  onClick={copyShareLink}
                  className="btn-secondary btn-sm flex items-center gap-1.5 shrink-0"
                >
                  <Clipboard className="w-4 h-4" />
                  {shareLinkCopied ? "Copied!" : "Copy Link"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500 mb-3">
              Generate a share link to let others view this project without logging in.
            </p>
            <button
              onClick={generateShareLink}
              className="btn-primary btn-sm flex items-center gap-1.5"
            >
              <Share2 className="w-4 h-4" />
              Generate Share Link
            </button>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-primary-500 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Timeline View */}
      {activeTab === "timeline" && (
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
                      {!!block.bid_count && block.bid_count > 0 && (
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
                    {(block.desired_start_date || block.desired_completion_date) && !block.actual_completion_date && !block.estimated_completion_date && (
                      <p className="text-xs text-gray-400">
                        Target: {block.desired_start_date ? `${block.desired_start_date} → ` : ""}{block.desired_completion_date || "open"}
                      </p>
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
      )}

      {/* Gantt Chart View */}
      {activeTab === "gantt" && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Gantt Chart</h2>
          <GanttChart blocks={blocks} />
        </div>
      )}

      {/* Block Cards (Blocks Tab) */}
      {activeTab === "blocks" && (
        <div className="mb-6">
          <BidsByTrade bids={projectBids} />
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
                    {!!block.bid_count && block.bid_count > 0 && (
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

                    <Attachments
                      projectId={project.id}
                      blockId={block.id}
                      canEdit
                      title="Block files"
                      emptyText="No files for this block yet."
                      className="mb-4"
                    />

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                      {block.status === "pending" && (
                        <button onClick={() => openForBids(block.id)} className="btn-primary btn-sm">
                          Open for Bids
                        </button>
                      )}
                      {block.status !== "completed" && (
                        <BlockEditButton
                          block={block}
                          blockDetail={blockDetail}
                          onSave={saveBlockEdit}
                          scale={projectScale(project.project_type, project.title)}
                          budget={project.budget}
                        />
                      )}
                    </div>
                    {!block.depends_on_completed && block.status !== "completed" && (
                      <p className="text-sm text-amber-600 mb-4 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        Upstream blocks not yet complete. Work cannot begin until they finish.
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
                              className={`bg-white rounded-lg border p-3 ${bid.status === "accepted" ? "border-green-300 bg-green-50" : bid.status === "needs_confirmation" ? "border-yellow-300 bg-yellow-50" : "border-gray-200"}`}
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
                                    {bid.status === "needs_confirmation" && (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full px-2 py-0.5">
                                        <AlertTriangle className="w-3 h-3" />
                                        Awaiting Confirmation
                                      </span>
                                    )}
                                    {bid.is_revision ? (
                                      <span className="badge bg-orange-100 text-orange-700">Revised bid</span>
                                    ) : null}
                                    {bid.delay_confirmed ? (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
                                        <CheckCircle2 className="w-3 h-3" />
                                        Delay Confirmed
                                      </span>
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
                                    {bidFinish(bid.start_date, bid.duration_days) && <span>Finish: {bidFinish(bid.start_date, bid.duration_days)}</span>}
                                    <span>License: {bid.license_info || "N/A"}</span>
                                  </div>
                                  <BidScheduleFit block={blockDetail} bid={bid} />
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-lg font-bold text-gray-900">${bid.price.toLocaleString()}</p>
                                  {bid.status === "needs_confirmation" && !!bid.is_revision && (
                                    <button
                                      onClick={() => acceptBid(bid.id)}
                                      className="btn-primary btn-sm mt-2"
                                    >
                                      Accept revised terms
                                    </button>
                                  )}
                                  {bid.status === "pending" && block.status !== "awarded" && block.status !== "in_progress" && block.status !== "completed" && (
                                    <button
                                      onClick={() => acceptBid(bid.id)}
                                      className="btn-primary btn-sm mt-2"
                                    >
                                      Accept Bid
                                    </button>
                                  )}
                                  {bid.status === "accepted" && block.status !== "completed" && (
                                    <>
                                      <button
                                        onClick={() => reopenBidding(bid.id)}
                                        className="btn-secondary btn-sm mt-2 text-amber-600 border-amber-300 hover:bg-amber-50"
                                      >
                                        Reopen Bidding
                                      </button>
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
                                    </>
                                  )}
                                  {bid.status === "accepted" && block.status === "completed" && (
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
        </div>
      )}

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
                <p>The Sawmill Grill &middot; Blueprint Caf&eacute; &middot; Cornerstone Bistro</p>
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


function BlockEditButton({
  block,
  blockDetail,
  onSave,
  scale,
  budget,
}: {
  block: Block;
  blockDetail: Record<string, unknown>;
  onSave: (blockId: number, updates: Record<string, unknown>, reopenBids?: boolean) => Promise<void>;
  scale: Scale;
  budget: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(block.title);
  const [editDescription, setEditDescription] = useState(block.description || "");
  const [editTradeType, setEditTradeType] = useState(block.trade_type || "");
  const [editDesiredStart, setEditDesiredStart] = useState(block.desired_start_date || "");
  const [editDesiredDate, setEditDesiredDate] = useState(block.desired_completion_date || "");
  const [editSpecialReq, setEditSpecialReq] = useState(block.special_requirements || "");
  const [saving, setSaving] = useState(false);

  const hasAcceptedBids = ((blockDetail.bids as Bid[]) || []).some((b) => b.status === "accepted");
  const needsReopen = hasAcceptedBids && block.status !== "pending";

  const handleSave = async () => {
    setSaving(true);
    await onSave(
      block.id,
      {
        title: editTitle,
        description: editDescription,
        trade_type: editTradeType,
        desired_start_date: editDesiredStart || null,
        desired_completion_date: editDesiredDate || null,
        special_requirements: editSpecialReq || null,
      },
      needsReopen
    );
    setSaving(false);
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="btn-secondary btn-sm flex items-center gap-1.5"
      >
        <Pencil className="w-3.5 h-3.5" />
        Edit Block
      </button>
    );
  }

  return (
    <div className="w-full mt-2 p-4 bg-white rounded-lg border-2 border-primary-200">
      <h3 className="text-sm font-semibold text-primary-600 mb-3 flex items-center gap-1.5">
        <Pencil className="w-3.5 h-3.5" />
        Edit Block
      </h3>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Block Title *</label>
          <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
        </div>
        <div>
          <label className="label">Trade Type</label>
          <select className="input" value={editTradeType} onChange={(e) => setEditTradeType(e.target.value)}>
            <option value="">Select trade...</option>
            {TRADE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Description</label>
          <textarea className="input" rows={2} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
        </div>
        <div>
          <label className="label">Target Start Date</label>
          <input className="input" type="date" value={editDesiredStart} onChange={(e) => setEditDesiredStart(e.target.value)} />
        </div>
        <div>
          <label className="label">Target Completion Date</label>
          <input className="input" type="date" value={editDesiredDate} min={editDesiredStart || undefined} onChange={(e) => setEditDesiredDate(e.target.value)} />
        </div>
        {(() => {
          const deps = (blockDetail.dependency_blocks as ScheduledBlock[]) || [];
          const earliest = earliestStart(deps.map(expectedFinish));
          if (!earliest) return null;
          const tooEarly = !!editDesiredStart && editDesiredStart < earliest;
          return (
            <p className={`sm:col-span-2 -mt-1 text-xs ${tooEarly ? "text-amber-700" : "text-primary-700"}`}>
              Earliest start {earliest}: the day after {deps.map((d) => d.title).join(", ")} {deps.length === 1 ? "is" : "are"} expected to finish.
              {editDesiredStart !== earliest && (
                <button
                  type="button"
                  className="ml-2 text-primary-600 hover:underline"
                  onClick={() => {
                    // Keep the block's length when moving its start
                    const length = editDesiredStart && editDesiredDate && editDesiredDate >= editDesiredStart
                      ? daysBetween(editDesiredStart, editDesiredDate) : null;
                    setEditDesiredStart(earliest);
                    if (length !== null) setEditDesiredDate(addDays(earliest, length));
                  }}
                >
                  Start then
                </button>
              )}
            </p>
          );
        })()}
        <DurationHint
          title={editTitle}
          tradeType={editTradeType}
          start={editDesiredStart}
          finish={editDesiredDate}
          onApply={setEditDesiredDate}
          scale={scale}
          budget={budget}
        />
        <div>
          <label className="label">Special Requirements</label>
          <input className="input" value={editSpecialReq} onChange={(e) => setEditSpecialReq(e.target.value)} />
        </div>
      </div>
      {needsReopen && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-sm text-amber-800 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            Saving changes will reopen this block for bidding since it has accepted bids.
          </p>
        </div>
      )}
      <div className="flex items-center gap-2 mt-3">
        <button onClick={handleSave} disabled={saving || !editTitle} className="btn-primary btn-sm">
          {saving ? "Saving..." : needsReopen ? "Save & Reopen Bids" : "Save Changes"}
        </button>
        <button onClick={() => setEditing(false)} className="btn-secondary btn-sm">Cancel</button>
      </div>
    </div>
  );
}

// Shows whether a bid's dates fit the owner's target and the neighbouring blocks.
function BidScheduleFit({ block, bid }: { block: Record<string, unknown>; bid: Bid }) {
  const check = checkBidSchedule(
    block as unknown as ScheduledBlock,
    (block.dependency_blocks as ScheduledBlock[]) || [],
    (block.downstream_blocks as ScheduledBlock[]) || [],
    bid.start_date,
    bid.duration_days
  );
  if (!check) return null;
  if (check.ok) {
    return (
      <p className="mt-2 text-xs text-green-700 flex items-center gap-1">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Fits your schedule
      </p>
    );
  }
  return (
    <ul className="mt-2 space-y-0.5">
      {check.issues.map((issue) => (
        <li key={issue} className="text-xs text-amber-700 flex items-start gap-1">
          <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
          {issue}
        </li>
      ))}
    </ul>
  );
}

// One row per trade with every block they bid on in this project, so multi-phase bids read as a package
function BidsByTrade({ bids }: { bids: Bid[] }) {
  const active = bids.filter((b) => b.status !== "rejected");
  const trades: { tradeId: number; name: string; tradeType?: string; rating?: number; bids: Bid[] }[] = [];
  for (const bid of active) {
    let t = trades.find((x) => x.tradeId === bid.trade_id);
    if (!t) {
      t = { tradeId: bid.trade_id, name: bid.trade_name || "Trade", tradeType: bid.trade_type, rating: bid.trade_rating, bids: [] };
      trades.push(t);
    }
    t.bids.push(bid);
  }
  if (trades.length === 0) return null;
  trades.sort((a, b) => b.bids.length - a.bids.length);

  return (
    <div className="card mb-6">
      <h2 className="font-semibold mb-1">Bids by trade</h2>
      <p className="text-sm text-gray-500 mb-4">Trades that bid on several blocks of this project are grouped together. Award each block from its own bid below.</p>
      <div className="divide-y divide-gray-100">
        {trades.map((t) => (
          <div key={t.tradeId} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{t.name}</span>
                {t.tradeType && <span className="text-xs text-gray-400">{t.tradeType}</span>}
                {!!t.rating && <span className="text-xs text-yellow-600">{t.rating} ★</span>}
                <span className="text-xs text-gray-500">· {t.bids.length} block{t.bids.length !== 1 ? "s" : ""}</span>
              </div>
              <span className="font-semibold text-sm">${t.bids.reduce((sum, b) => sum + b.price, 0).toLocaleString()}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {t.bids.map((b) => (
                <span key={b.id} className="inline-flex items-center gap-1.5 text-xs bg-gray-50 border rounded px-2 py-1">
                  {b.block_title} · ${b.price.toLocaleString()}
                  <StatusBadge status={b.status} />
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
