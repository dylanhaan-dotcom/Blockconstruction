"use client";

import React from "react";
import { Clock } from "lucide-react";
import { typicalDays } from "@/lib/durations";
import { addDays, daysBetween } from "@/lib/schedule";

// Typical length for a block, with a shortcut to set the finish date from the start date
export function DurationHint({
  title, tradeType, start, finish, onApply,
}: {
  title: string;
  tradeType: string;
  start: string;
  finish: string;
  onApply: (finish: string) => void;
}) {
  if (!title && !tradeType) return null;
  const days = typicalDays(title, tradeType || null);
  const window = start && finish && finish >= start ? daysBetween(start, finish) + 1 : null;
  return (
    <div className="sm:col-span-2 -mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
      <span className="flex items-center gap-1">
        <Clock className="w-3.5 h-3.5" />
        Typical length for this kind of work: about {days} day{days !== 1 ? "s" : ""}
      </span>
      {window !== null && <span>· Your window: {window} day{window !== 1 ? "s" : ""}</span>}
      {start && window !== days && (
        <button type="button" onClick={() => onApply(addDays(start, days - 1))} className="text-primary-600 hover:underline">
          Set finish to {days} days after start
        </button>
      )}
    </div>
  );
}
