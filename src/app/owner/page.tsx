"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "@/lib/context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { Project, Appreciation } from "@/lib/types";
import { Plus, FolderOpen, DollarSign, CheckCircle2, Clock, Heart } from "lucide-react";

export default function OwnerDashboard() {
  const { currentUser, loading: sessionLoading } = useApp();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [appreciations, setAppreciations] = useState<Appreciation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (!currentUser || currentUser.role !== "project_owner") {
      router.push("/");
      return;
    }
    Promise.all([
      fetch(`/api/projects?owner_id=${currentUser.id}`).then((r) => r.json()),
      fetch(`/api/appreciation?from_user_id=${currentUser.id}`).then((r) => r.json()),
    ]).then(([p, a]) => {
      setProjects(p);
      setAppreciations(a);
      setLoading(false);
    });
  }, [currentUser, sessionLoading, router]);

  if (sessionLoading || !currentUser || loading) {
    return <div className="flex items-center justify-center h-64"><p className="text-gray-500">Loading...</p></div>;
  }

  const totalBudget = projects.reduce((s, p) => s + (p.budget || 0), 0);
  const totalAwarded = projects.reduce((s, p) => s + (p.total_awarded || 0), 0);
  const totalBlocks = projects.reduce((s, p) => s + (p.block_count || 0), 0);
  const completedBlocks = projects.reduce((s, p) => s + (p.completed_blocks || 0), 0);
  const totalAppreciation = appreciations.reduce((s, a) => s + a.amount, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {currentUser.name}</h1>
          <p className="text-gray-500 text-sm mt-1">Manage your construction projects</p>
        </div>
        <Link href="/owner/projects/new" className="btn-primary flex items-center gap-2 w-fit">
          <Plus className="w-4 h-4" />
          New Project
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
            <FolderOpen className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{projects.length}</p>
            <p className="text-xs text-gray-500">Projects</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{completedBlocks}/{totalBlocks}</p>
            <p className="text-xs text-gray-500">Blocks Done</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">${totalBudget.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Total Budget</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent-100 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-accent-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">${totalAwarded.toLocaleString()}</p>
            <p className="text-xs text-gray-500">Awarded</p>
          </div>
        </div>
        <div className="card flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-pink-100 flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5 text-pink-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">${totalAppreciation}</p>
            <p className="text-xs text-gray-500">Appreciation</p>
          </div>
        </div>
      </div>

      {/* Projects */}
      <h2 className="text-lg font-semibold mb-4">Your Projects</h2>
      {projects.length === 0 ? (
        <div className="card text-center py-12">
          <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">No projects yet. Create your first project to get started.</p>
          <Link href="/owner/projects/new" className="btn-primary">
            Create Project
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/owner/projects/${project.id}`}
              className="card hover:shadow-md transition-shadow group"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                  {project.title}
                </h3>
                <StatusBadge status={project.status} />
              </div>
              <p className="text-sm text-gray-500 mb-3">{project.address}</p>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>{project.block_count} blocks</span>
                <span>{project.completed_blocks} completed</span>
              </div>
              {/* Progress bar */}
              <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${project.block_count ? (project.completed_blocks! / project.block_count) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                <span>Budget: ${(project.budget || 0).toLocaleString()}</span>
                <span>Awarded: ${(project.total_awarded || 0).toLocaleString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
