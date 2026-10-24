"use client";

import React, { useCallback, useEffect, useMemo, useState, use } from "react";
import { useApp } from "@/lib/context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { ScheduleTimeline, TimelineRow } from "@/components/ScheduleTimeline";
import { Attachments } from "@/components/Attachments";
import { Bid, Block, Project } from "@/lib/types";
import {
  bidFinish, checkBidSchedule, expectedFinish, expectedStart, targetWindow,
} from "@/lib/schedule";
import {
  ArrowLeft, AlertTriangle, CalendarCheck, CheckCircle2, Layers, MapPin, Send, User,
} from "lucide-react";

interface Draft {
  selected: boolean;
  price: string;
  start: string;
  duration: string;
  note: string;
}

export default function TradeProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { currentUser, loading: sessionLoading } = useApp();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [myBids, setMyBids] = useState<Bid[]>([]);
  const [drafts, setDrafts] = useState<Record<number, Draft>>({});
  const [onlyMyTrades, setOnlyMyTrades] = useState(true);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: number; errors: string[] } | null>(null);

  const myTrades = useMemo(
    () => [currentUser?.trade_type, ...(currentUser?.secondary_trades || [])].filter((t): t is string => !!t),
    [currentUser?.trade_type, currentUser?.secondary_trades]
  );

  const fetchData = useCallback(() => {
    Promise.all([
      fetch(`/api/projects/${id}`).then((r) => r.json()),
      fetch(`/api/blocks?project_id=${id}`).then((r) => r.json()),
      fetch(`/api/bids?project_id=${id}`).then((r) => (r.ok ? r.json() : [])),
    ]).then(([p, b, bids]: [Project, Block[], Bid[]]) => {
      setProject(p);
      setBlocks(b);
      setMyBids(bids);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!currentUser || currentUser.role !== "trade") {
      router.push("/");
      return;
    }
    fetchData();
  }, [currentUser?.id, sessionLoading, router, fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

  const byId = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);
  const upstreamOf = useCallback(
    (b: Block) => (b.dependencies || []).map((d) => byId.get(d)).filter((x): x is Block => !!x),
    [byId]
  );
  const downstreamOf = useCallback(
    (b: Block) => blocks.filter((x) => (x.dependencies || []).includes(b.id)),
    [blocks]
  );
  const latestBid = useCallback(
    (blockId: number) => myBids.find((bid) => bid.block_id === blockId),
    [myBids]
  );
  const isBiddable = (b: Block) => b.status === "open_for_bids" && latestBid(b.id)?.status !== "accepted";

  // Start every open block's draft from the trade's open bid, or else the owner's target window
  useEffect(() => {
    const next: Record<number, Draft> = {};
    for (const b of blocks) {
      const bid = latestBid(b.id);
      const openBid = bid && (bid.status === "pending" || bid.status === "needs_confirmation") ? bid : null;
      const target = targetWindow(b, upstreamOf(b));
      next[b.id] = {
        selected: false,
        price: openBid ? String(openBid.price) : "",
        start: openBid?.start_date || target.start || "",
        duration: openBid?.duration_days ? String(openBid.duration_days) : target.duration ? String(target.duration) : "",
        note: openBid?.description || "",
      };
    }
    setDrafts(next);
  }, [blocks, latestBid, upstreamOf]);

  const updateDraft = (blockId: number, changes: Partial<Draft>) => {
    setDrafts((prev) => ({ ...prev, [blockId]: { ...prev[blockId], ...changes } }));
  };

  if (loading || !project || !currentUser) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Loading...</p></div>;
  }

  const inMyTrades = (b: Block) => !!b.trade_type && myTrades.includes(b.trade_type);
  const listed = onlyMyTrades ? blocks.filter(inMyTrades) : blocks;
  const selected = blocks.filter((b) => drafts[b.id]?.selected && isBiddable(b));
  const total = selected.reduce((sum, b) => sum + (Number(drafts[b.id]?.price) || 0), 0);
  const missingPrice = selected.some((b) => !(Number(drafts[b.id]?.price) > 0));

  const targetStarts = blocks.map((b) => targetWindow(b, upstreamOf(b)).start).filter((d): d is string => !!d).sort();
  const targetFinishes = blocks.map((b) => b.desired_completion_date).filter((d): d is string => !!d).sort();

  const timelineRows: TimelineRow[] = blocks.flatMap((b) => {
    const target = targetWindow(b, upstreamOf(b));
    const rows: TimelineRow[] = [{
      key: `b-${b.id}`,
      label: b.title,
      sublabel: `${b.trade_type || "Any trade"} · ${b.status.replace(/_/g, " ")}`,
      kind: inMyTrades(b) ? "match" : "block",
      start: expectedStart(b) || target.start,
      finish: expectedFinish(b),
    }];
    const d = drafts[b.id];
    if (d?.selected && d.start && Number(d.duration) > 0) {
      const check = checkBidSchedule(b, upstreamOf(b), downstreamOf(b), d.start, Number(d.duration));
      rows.push({
        key: `p-${b.id}`, label: "Your dates", kind: "proposal",
        start: d.start, finish: bidFinish(d.start, Number(d.duration)), warn: check ? !check.ok : false,
      });
    }
    return rows;
  });

  const submit = async () => {
    setSubmitting(true);
    setResult(null);
    let ok = 0;
    const errors: string[] = [];
    for (const b of selected) {
      const d = drafts[b.id];
      const res = await fetch("/api/bids", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          block_id: b.id,
          price: Number(d.price),
          start_date: d.start || null,
          duration_days: Number(d.duration) || null,
          description: d.note || null,
          license_info: currentUser.license_info,
          insurance_info: currentUser.insurance_info,
        }),
      });
      if (res.ok) ok++;
      else errors.push(`${b.title}: ${(await res.json().catch(() => ({}))).error || "could not submit"}`);
    }
    setResult({ ok, errors });
    setSubmitting(false);
    fetchData();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-28">
      <Link href="/trade/blocks" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back to Blocks
      </Link>

      {/* Project header */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{project.title}</h1>
              <StatusBadge status={project.status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{project.address}</span>
              {project.owner_name && <span className="flex items-center gap-1"><User className="w-4 h-4" />{project.owner_name}</span>}
            </div>
            {project.description && <p className="text-sm text-gray-600 mt-3">{project.description}</p>}
          </div>
          <div className="flex items-center gap-6 text-sm shrink-0">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{blocks.length}</p>
              <p className="text-gray-500">Blocks</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary-600">{blocks.filter(inMyTrades).length}</p>
              <p className="text-gray-500">Your trades</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{blocks.filter((b) => b.status === "open_for_bids").length}</p>
              <p className="text-gray-500">Open</p>
            </div>
          </div>
        </div>
        {(targetStarts.length > 0 || targetFinishes.length > 0) && (
          <p className="text-sm text-gray-500 mt-4 flex items-center gap-1.5">
            <CalendarCheck className="w-4 h-4 text-gray-400" />
            Owner&apos;s target for the whole project: {targetStarts[0] || "?"} → {targetFinishes[targetFinishes.length - 1] || "?"}
          </p>
        )}
      </div>

      <Attachments projectId={project.id} blockId="all" title="Plans, photos & specs" className="card mb-6" />

      {/* Whole-project schedule */}
      <div className="card mb-6">
        <h2 className="font-semibold mb-1 flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary-600" />
          Project schedule
        </h2>
        <p className="text-sm text-gray-500 mb-4">Every phase of the project in order. Blocks in your trades are highlighted; dates you&apos;re drafting below appear under their block.</p>
        <ScheduleTimeline rows={timelineRows} />
      </div>

      {/* Bid on several blocks at once */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
          <h2 className="font-semibold flex items-center gap-2">
            <Send className="w-4 h-4 text-primary-600" />
            Bid on the pieces you can do
          </h2>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={onlyMyTrades} onChange={(e) => setOnlyMyTrades(e.target.checked)} className="rounded" />
            Only my trades
          </label>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Tick each block you want, set a price, and submit them together. Each one becomes its own bid, so the owner can award them separately.
          Resubmitting a block you already bid on updates that bid.
        </p>

        {listed.length === 0 ? (
          <p className="text-sm text-gray-500">
            No blocks in your trades on this project. Untick &ldquo;Only my trades&rdquo; to see everything.
          </p>
        ) : (
          <div className="space-y-3">
            {listed.map((b) => {
              const d = drafts[b.id];
              const bid = latestBid(b.id);
              const biddable = isBiddable(b);
              const upstream = upstreamOf(b);
              const target = targetWindow(b, upstream);
              const check = d?.selected
                ? checkBidSchedule(b, upstream, downstreamOf(b), d.start, Number(d.duration) || null)
                : null;
              return (
                <div
                  key={b.id}
                  className={`rounded-lg border p-3 ${d?.selected ? "border-primary-300 bg-primary-50/40" : "border-gray-200"}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 rounded"
                      disabled={!biddable}
                      checked={!!d?.selected && biddable}
                      onChange={(e) => updateDraft(b.id, { selected: e.target.checked })}
                      aria-label={`Bid on ${b.title}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/trade/blocks/${b.id}`} className="font-medium text-gray-900 hover:text-primary-600">{b.title}</Link>
                        <StatusBadge status={b.status} />
                        {b.trade_type && (
                          <span className={`badge ${inMyTrades(b) ? "bg-primary-100 text-primary-700" : "bg-gray-100 text-gray-600"}`}>
                            {b.trade_type}
                          </span>
                        )}
                        {bid && (
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            You bid ${bid.price.toLocaleString()} <StatusBadge status={bid.status} />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Target: {target.start || "?"} → {target.finish || "?"}
                        {target.duration ? ` (${target.duration} days)` : ""}
                        {upstream.length > 0 && ` · After ${upstream.map((u) => u.title).join(", ")}`}
                      </p>
                      {!biddable && (
                        <p className="text-xs text-gray-400 mt-1">
                          {bid?.status === "accepted" ? "Your bid was accepted." : "Not open for bids right now."}
                        </p>
                      )}

                      {d?.selected && biddable && (
                        <div className="mt-3 space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                              <label className="label">Price ($) *</label>
                              <input className="input" type="number" min="1" value={d.price} onChange={(e) => updateDraft(b.id, { price: e.target.value })} />
                            </div>
                            <div>
                              <label className="label">Start</label>
                              <input className="input" type="date" value={d.start} onChange={(e) => updateDraft(b.id, { start: e.target.value })} />
                            </div>
                            <div>
                              <label className="label">Days</label>
                              <input className="input" type="number" min="1" value={d.duration} onChange={(e) => updateDraft(b.id, { duration: e.target.value })} />
                            </div>
                            <div className="flex items-end">
                              {(target.start || target.duration) && (
                                <button
                                  type="button"
                                  onClick={() => updateDraft(b.id, {
                                    start: target.start || d.start,
                                    duration: target.duration ? String(target.duration) : d.duration,
                                  })}
                                  className="btn-secondary btn-sm w-full"
                                >
                                  Match owner
                                </button>
                              )}
                            </div>
                          </div>
                          <input
                            className="input"
                            value={d.note}
                            onChange={(e) => updateDraft(b.id, { note: e.target.value })}
                            placeholder="Notes on your approach (optional)"
                          />
                          {check && (check.ok ? (
                            <p className="text-xs text-green-700 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Fits the owner&apos;s schedule
                            </p>
                          ) : (
                            <ul className="space-y-0.5">
                              {check.issues.map((issue) => (
                                <li key={issue} className="text-xs text-amber-700 flex items-start gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />{issue}
                                </li>
                              ))}
                            </ul>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {result && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${result.errors.length ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-700"}`}>
            {result.ok > 0 && <p>Submitted {result.ok} bid{result.ok !== 1 ? "s" : ""}.</p>}
            {result.errors.map((e) => <p key={e}>{e}</p>)}
          </div>
        )}
      </div>

      {/* Package summary */}
      {selected.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 shadow-lg z-40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-700">
              <strong>{selected.length}</strong> block{selected.length !== 1 ? "s" : ""} selected · Total <strong>${total.toLocaleString()}</strong>
              {missingPrice && <span className="text-amber-600"> · add a price to each block</span>}
            </p>
            <button onClick={submit} disabled={submitting || missingPrice} className="btn-primary flex items-center gap-2">
              <Send className="w-4 h-4" />
              {submitting ? "Submitting..." : `Submit ${selected.length} bid${selected.length !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
