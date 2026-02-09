"use client";

import React, { useEffect, useState, use } from "react";
import { StatusBadge } from "@/components/StatusBadge";
import { GanttChart } from "@/components/GanttChart";
import { Block, Project } from "@/lib/types";
import { Building2, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

export default function SharedProjectPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [project, setProject] = useState<Project | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/projects?share_token=${token}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((projects) => {
        if (!projects.length) throw new Error();
        const p = projects[0];
        setProject(p);
        return fetch(`/api/blocks?project_id=${p.id}`);
      })
      .then((r) => r.json())
      .then((b) => {
        setBlocks(b);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><p className="text-gray-500">Loading shared project...</p></div>;
  }

  if (error || !project) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">Project not found or link has expired.</p>
        </div>
      </div>
    );
  }

  const completed = blocks.filter((b) => b.status === "completed").length;
  const inProgress = blocks.filter((b) => b.status === "in_progress").length;
  const delayed = blocks.filter((b) => b.status === "delayed").length;
  const totalAwarded = blocks.reduce((s, b) => s + (b.awarded_price || 0), 0);

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "in_progress": return <Clock className="w-4 h-4 text-yellow-500" />;
      case "delayed": return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return <div className="w-4 h-4 rounded-full border-2 border-gray-300" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg">Block<span className="text-primary-600">Construction</span></span>
        </div>
        <p className="text-xs text-gray-400">Shared Project View</p>
      </div>

      {/* Project header */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{project.title}</h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-gray-500 text-sm">{project.address}</p>
            {project.description && <p className="text-sm text-gray-600 mt-2">{project.description}</p>}
            <p className="text-xs text-gray-400 mt-1">Owner: {project.owner_name}</p>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold">{blocks.length}</p>
              <p className="text-gray-500">Blocks</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{completed}</p>
              <p className="text-gray-500">Done</p>
            </div>
            {delayed > 0 && (
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{delayed}</p>
                <p className="text-gray-500">Delayed</p>
              </div>
            )}
            {project.budget && (
              <div className="text-center">
                <p className="text-2xl font-bold">${project.budget.toLocaleString()}</p>
                <p className="text-gray-500">Budget</p>
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-primary-500 h-2.5 rounded-full transition-all"
            style={{ width: `${blocks.length ? (completed / blocks.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Gantt Chart */}
      <h2 className="text-lg font-semibold mb-3">Project Schedule</h2>
      <div className="mb-6">
        <GanttChart blocks={blocks} />
      </div>

      {/* Block list */}
      <h2 className="text-lg font-semibold mb-3">All Blocks</h2>
      <div className="space-y-2">
        {blocks.map((block) => (
          <div key={block.id} className="card !p-4">
            <div className="flex items-center gap-3">
              {statusIcon(block.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{block.title}</span>
                  <StatusBadge status={block.status} />
                  {block.trade_type && <span className="text-xs text-gray-400">{block.trade_type}</span>}
                </div>
                {block.dependency_names && block.dependency_names.length > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">Depends on: {block.dependency_names.join(", ")}</p>
                )}
              </div>
              <div className="text-right shrink-0 text-sm">
                {block.awarded_trade && <p className="text-xs font-medium">{block.awarded_trade}</p>}
                {block.awarded_price && <p className="text-xs text-green-600">${block.awarded_price.toLocaleString()}</p>}
                {block.actual_completion_date && <p className="text-xs text-green-600">Done: {block.actual_completion_date}</p>}
                {!block.actual_completion_date && block.estimated_completion_date && (
                  <p className="text-xs text-gray-500">Est: {block.estimated_completion_date}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 text-center text-xs text-gray-400">
        <p>Powered by BlockConstruction</p>
      </div>
    </div>
  );
}
