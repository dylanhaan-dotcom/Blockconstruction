"use client";

import React, { useMemo } from "react";
import { Block } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  completed: "#22c55e",
  in_progress: "#eab308",
  delayed: "#ef4444",
  awarded: "#a855f7",
  open_for_bids: "#3b82f6",
  pending: "#d1d5db",
};

interface GanttChartProps {
  blocks: Block[];
}

export function GanttChart({ blocks }: GanttChartProps) {
  const { rows, startDate, totalDays, monthLabels } = useMemo(() => {
    const now = new Date();

    // Find date range across all blocks
    const dates: Date[] = [now];
    for (const b of blocks) {
      if (b.desired_completion_date) dates.push(new Date(b.desired_completion_date));
      if (b.estimated_completion_date) dates.push(new Date(b.estimated_completion_date));
      if (b.actual_completion_date) dates.push(new Date(b.actual_completion_date));
    }

    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Add 2 week padding on each side
    const start = new Date(minDate);
    start.setDate(start.getDate() - 14);
    const end = new Date(maxDate);
    end.setDate(end.getDate() + 14);

    const total = Math.max(Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)), 30);

    // Month labels
    const months: { label: string; offset: number; width: number }[] = [];
    const cursor = new Date(start);
    cursor.setDate(1);
    if (cursor < start) cursor.setMonth(cursor.getMonth() + 1);
    while (cursor <= end) {
      const monthStart = Math.max(0, Math.ceil((cursor.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      const nextMonth = new Date(cursor);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const monthEnd = Math.min(total, Math.ceil((nextMonth.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
      months.push({
        label: cursor.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        offset: monthStart,
        width: monthEnd - monthStart,
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // Build rows
    const builtRows = blocks.map((block) => {
      // Determine bar start and end
      let barStart: number;
      let barEnd: number;
      const awarded = block.awarded_price != null;

      if (block.actual_completion_date && block.status === "completed") {
        // Completed: show actual duration (estimate 7 days before completion as start)
        const completedDate = new Date(block.actual_completion_date);
        const estimatedStart = new Date(completedDate);
        estimatedStart.setDate(estimatedStart.getDate() - 7);
        barStart = Math.max(0, Math.ceil((estimatedStart.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        barEnd = Math.ceil((completedDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      } else if (block.estimated_completion_date) {
        const estEnd = new Date(block.estimated_completion_date);
        const estStart = new Date(estEnd);
        estStart.setDate(estStart.getDate() - (awarded ? 7 : 5));
        barStart = Math.max(0, Math.ceil((estStart.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        barEnd = Math.ceil((estEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      } else if (block.desired_completion_date) {
        const desEnd = new Date(block.desired_completion_date);
        const desStart = new Date(desEnd);
        desStart.setDate(desStart.getDate() - 7);
        barStart = Math.max(0, Math.ceil((desStart.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        barEnd = Math.ceil((desEnd.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        barStart = 0;
        barEnd = 5;
      }

      return {
        block,
        barStart,
        barEnd: Math.max(barEnd, barStart + 2),
        color: STATUS_COLORS[block.status] || "#d1d5db",
      };
    });

    return { rows: builtRows, startDate: start, totalDays: total, monthLabels: months };
  }, [blocks]);

  // Today marker
  const todayOffset = Math.ceil((new Date().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: Math.max(800, totalDays * 8 + 220) }}>
          {/* Month headers */}
          <div className="flex border-b border-gray-200">
            <div className="w-[220px] shrink-0 px-3 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-r border-gray-200">
              Block
            </div>
            <div className="flex-1 relative" style={{ height: 28 }}>
              {monthLabels.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 text-xs font-medium text-gray-500 border-l border-gray-200 px-1.5 py-1.5 bg-gray-50"
                  style={{
                    left: `${(m.offset / totalDays) * 100}%`,
                    width: `${(m.width / totalDays) * 100}%`,
                  }}
                >
                  {m.label}
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          {rows.map((row) => (
            <div key={row.block.id} className="flex border-b border-gray-50 hover:bg-gray-50 group">
              <div className="w-[220px] shrink-0 px-3 py-2 border-r border-gray-100">
                <p className="text-xs font-medium text-gray-900 truncate">{row.block.title}</p>
                <p className="text-[10px] text-gray-400 truncate">
                  {row.block.trade_type || "Unassigned"}
                  {row.block.awarded_trade ? ` - ${row.block.awarded_trade}` : ""}
                </p>
              </div>
              <div className="flex-1 relative py-1.5">
                {/* Today line */}
                {todayOffset >= 0 && todayOffset <= totalDays && (
                  <div
                    className="absolute top-0 bottom-0 w-px bg-red-400 z-10 opacity-50"
                    style={{ left: `${(todayOffset / totalDays) * 100}%` }}
                  />
                )}
                {/* Dependency arrows - shown as thin lines connecting to upstream bars */}
                {row.block.dependencies?.map((depId) => {
                  const depRow = rows.find((r) => r.block.id === depId);
                  if (!depRow) return null;
                  return (
                    <div
                      key={depId}
                      className="absolute h-px bg-gray-300 top-1/2 z-0"
                      style={{
                        left: `${(depRow.barEnd / totalDays) * 100}%`,
                        width: `${(Math.max(0, row.barStart - depRow.barEnd) / totalDays) * 100}%`,
                      }}
                    />
                  );
                })}
                {/* Bar */}
                <div
                  className="absolute top-1.5 bottom-1.5 rounded-md transition-all group-hover:opacity-90 z-20 flex items-center px-1.5"
                  style={{
                    left: `${(row.barStart / totalDays) * 100}%`,
                    width: `${((row.barEnd - row.barStart) / totalDays) * 100}%`,
                    backgroundColor: row.color,
                    minWidth: 16,
                  }}
                >
                  {((row.barEnd - row.barStart) / totalDays) * 100 > 8 && (
                    <span className="text-[10px] font-medium text-white truncate">
                      {row.block.awarded_price ? `$${row.block.awarded_price.toLocaleString()}` : row.block.status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center gap-4 px-3 py-2 bg-gray-50 border-t border-gray-200">
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-[10px] text-gray-500 capitalize">{status.replace(/_/g, " ")}</span>
              </div>
            ))}
            <div className="flex items-center gap-1.5 ml-2">
              <div className="w-3 h-px bg-red-400" />
              <span className="text-[10px] text-gray-500">Today</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
