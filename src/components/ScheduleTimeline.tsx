"use client";

import React from "react";
import { addDays, daysBetween } from "@/lib/schedule";

export interface TimelineRow {
  key: string;
  label: string;
  sublabel?: string;
  kind: "upstream" | "target" | "proposal" | "downstream";
  start: string | null;
  finish: string | null;
  warn?: boolean;
}

const KIND_STYLES: Record<TimelineRow["kind"], string> = {
  upstream: "bg-gray-400",
  target: "bg-primary-200 border border-dashed border-primary-500",
  proposal: "bg-accent-500",
  downstream: "bg-gray-300",
};

// Horizontal bars on one shared date axis. A row with only one date is drawn as a marker on that day.
export function ScheduleTimeline({ rows }: { rows: TimelineRow[] }) {
  const dates = rows.flatMap((r) => [r.start, r.finish]).filter((d): d is string => !!d).sort();
  if (dates.length === 0) {
    return <p className="text-sm text-gray-500">No dates set yet for this block or its neighbours.</p>;
  }

  const rangeStart = addDays(dates[0], -2);
  const rangeEnd = addDays(dates[dates.length - 1], 3);
  const totalDays = Math.max(daysBetween(rangeStart, rangeEnd), 1);
  const pct = (day: string) => (daysBetween(rangeStart, day) / totalDays) * 100;

  return (
    <div className="space-y-2">
      <div className="flex text-[11px] text-gray-400">
        <div className="w-28 sm:w-44 shrink-0" />
        <div className="flex-1 flex justify-between">
          <span>{dates[0]}</span>
          <span>{dates[dates.length - 1]}</span>
        </div>
      </div>
      {rows.map((row) => {
        const start = row.start || row.finish;
        const finish = row.finish || row.start;
        const isMarker = !row.start || !row.finish;
        return (
          <div key={row.key} className="flex items-center gap-2">
            <div className="w-28 sm:w-44 shrink-0 min-w-0">
              <p className={`text-xs font-medium truncate ${row.kind === "proposal" ? "text-accent-700" : row.kind === "target" ? "text-primary-700" : "text-gray-700"}`}>
                {row.label}
              </p>
              {row.sublabel && <p className="text-[11px] text-gray-400 truncate">{row.sublabel}</p>}
            </div>
            <div className="relative flex-1 h-6 bg-gray-50 rounded">
              {start && finish && (
                isMarker ? (
                  <div
                    className={`absolute top-1 w-4 h-4 -ml-2 rotate-45 rounded-sm ${KIND_STYLES[row.kind]} ${row.warn ? "ring-2 ring-red-400" : ""}`}
                    style={{ left: `${pct(start)}%` }}
                    title={start}
                  />
                ) : (
                  <div
                    className={`absolute top-1 h-4 rounded ${KIND_STYLES[row.kind]} ${row.warn ? "ring-2 ring-red-400" : ""}`}
                    style={{ left: `${pct(start)}%`, width: `${Math.max(((daysBetween(start, finish) + 1) / totalDays) * 100, 1.5)}%` }}
                    title={`${start} → ${finish}`}
                  />
                )
              )}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px] text-gray-500">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-gray-400" /> Upstream</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-primary-200 border border-dashed border-primary-500" /> Owner&apos;s target</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-accent-500" /> Your dates</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded bg-gray-300" /> Downstream</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rotate-45 bg-gray-400" /> Single known date</span>
      </div>
    </div>
  );
}
