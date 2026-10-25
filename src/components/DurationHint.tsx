"use client";

import React from "react";
import { Clock, DollarSign } from "lucide-react";
import { NAHB_STAGES, SOURCES, Scale, Source, benchmarkFor, formatMoney } from "@/lib/benchmarks";
import { addDays, daysBetween } from "@/lib/schedule";

export function SourceLink({ source }: { source: Source }) {
  if (!source.url) return <span className="text-gray-400">{source.label}</span>;
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 underline decoration-dotted hover:text-gray-600">
      {source.label}
    </a>
  );
}

// Typical length (and cost reference) for a block, with a shortcut to set the finish date from the start date
export function DurationHint({
  title, tradeType, start, finish, onApply, scale = "remodel", budget,
}: {
  title: string;
  tradeType: string;
  start: string;
  finish: string;
  onApply: (finish: string) => void;
  scale?: Scale;
  budget?: number | null;
}) {
  if (!title && !tradeType) return null;
  const benchmark = benchmarkFor(title, tradeType || null, scale);
  const days = benchmark.days;
  const window = start && finish && finish >= start ? daysBetween(start, finish) + 1 : null;
  const stage = benchmark.stage ? NAHB_STAGES[benchmark.stage] : null;

  return (
    <div className="sm:col-span-2 -mt-1 space-y-1 text-xs text-gray-500">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          Typical length: about {days} day{days !== 1 ? "s" : ""}
          {benchmark.range && <span className="text-gray-400">({benchmark.range})</span>}
        </span>
        {window !== null && <span>· Your window: {window} day{window !== 1 ? "s" : ""}</span>}
        {start && window !== days && (
          <button type="button" onClick={() => onApply(addDays(start, days - 1))} className="text-primary-600 hover:underline">
            Set finish to {days} days after start
          </button>
        )}
      </div>
      {(benchmark.cost || stage) && (
        <div className="flex items-start gap-1">
          <DollarSign className="w-3.5 h-3.5 mt-px shrink-0" />
          {benchmark.cost ? (
            <span>Typical cost: {formatMoney(benchmark.cost.low)}–{formatMoney(benchmark.cost.high)} (national range)</span>
          ) : stage ? (
            <span>
              Part of &ldquo;{stage.label}&rdquo;, about {(stage.share * 100).toFixed(1)}% of a new home&apos;s construction cost
              {budget ? ` — roughly ${formatMoney(budget * stage.share)} of your ${formatMoney(budget)} budget for the whole stage` : ""}
            </span>
          ) : null}
        </div>
      )}
      <p className="text-[11px]">
        Source: <SourceLink source={benchmark.durationSource} />
        {benchmark.cost && benchmark.cost.source !== benchmark.durationSource && <> · Cost: <SourceLink source={benchmark.cost.source} /></>}
        {stage && <> · Cost share: <SourceLink source={SOURCES.nahbCost} /></>}
      </p>
    </div>
  );
}
