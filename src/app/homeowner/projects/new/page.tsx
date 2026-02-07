"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "@/lib/context";
import { useRouter } from "next/navigation";
import { ProjectTemplate } from "@/lib/types";
import { ArrowLeft, Plus, Trash2, FileText } from "lucide-react";
import Link from "next/link";

interface BlockForm {
  title: string;
  description: string;
  trade_type: string;
  desired_completion_date: string;
  special_requirements: string;
  depends_on: number[];
}

export default function NewProjectPage() {
  const { currentUser } = useApp();
  const router = useRouter();
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [projectType, setProjectType] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [blocks, setBlocks] = useState<BlockForm[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentUser || currentUser.role !== "homeowner") {
      router.push("/");
      return;
    }
    fetch("/api/templates").then((r) => r.json()).then(setTemplates);
  }, [currentUser, router]);

  const applyTemplate = (template: ProjectTemplate) => {
    setProjectType(template.project_type);
    setTitle(template.name);
    setBlocks(
      template.blocks.map((b) => ({
        title: b.title,
        description: b.description,
        trade_type: b.trade_type,
        desired_completion_date: "",
        special_requirements: b.special_requirements,
        depends_on: b.depends_on,
      }))
    );
  };

  const addBlock = () => {
    setBlocks([
      ...blocks,
      { title: "", description: "", trade_type: "", desired_completion_date: "", special_requirements: "", depends_on: [] },
    ]);
  };

  const updateBlock = (index: number, field: keyof BlockForm, value: string | number[]) => {
    const updated = [...blocks];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[index] as any)[field] = value;
    setBlocks(updated);
  };

  const removeBlock = (index: number) => {
    const updated = blocks.filter((_, i) => i !== index);
    // Fix dependency references
    for (const block of updated) {
      block.depends_on = block.depends_on
        .filter((d) => d !== index)
        .map((d) => (d > index ? d - 1 : d));
    }
    setBlocks(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);

    // Create project
    const projectRes = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner_id: currentUser.id,
        title,
        address,
        project_type: projectType,
        description,
        budget: budget ? Number(budget) : null,
      }),
    });
    const project = await projectRes.json();

    // Create blocks sequentially to get IDs for dependencies
    const blockIds: number[] = [];
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const deps = block.depends_on.map((d) => blockIds[d]).filter(Boolean);
      const blockRes = await fetch("/api/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: project.id,
          title: block.title,
          description: block.description,
          trade_type: block.trade_type,
          desired_completion_date: block.desired_completion_date || null,
          special_requirements: block.special_requirements || null,
          sort_order: i,
          dependencies: deps,
        }),
      });
      const created = await blockRes.json();
      blockIds.push(created.id);
    }

    router.push(`/homeowner/projects/${project.id}`);
  };

  if (!currentUser) return null;

  const TRADE_TYPES = ["Electrician", "Plumber", "Carpenter", "Tile Installer", "Painter", "HVAC", "Roofer", "Concrete", "Landscaper", "General Contractor"];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <Link href="/homeowner" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      <h1 className="text-2xl font-bold mb-6">Create New Project</h1>

      {/* Templates */}
      <div className="card mb-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary-600" />
          Start from Template
        </h2>
        <div className="flex flex-wrap gap-2">
          {templates.map((t) => (
            <button
              key={t.name}
              onClick={() => applyTemplate(t)}
              className="btn-secondary btn-sm"
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Project Info */}
        <div className="card mb-6">
          <h2 className="font-semibold mb-4">Project Details</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Project Title *</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g., Kitchen Remodel" />
            </div>
            <div>
              <label className="label">Project Type *</label>
              <input className="input" value={projectType} onChange={(e) => setProjectType(e.target.value)} required placeholder="e.g., Kitchen Remodel" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Address *</label>
              <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="Project address" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the project scope..." />
            </div>
            <div>
              <label className="label">Budget ($)</label>
              <input className="input" type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="e.g., 45000" />
            </div>
          </div>
        </div>

        {/* Blocks */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Work Blocks ({blocks.length})</h2>
            <button type="button" onClick={addBlock} className="btn-primary btn-sm flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Add Block
            </button>
          </div>

          {blocks.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-gray-500 mb-3">No blocks yet. Add blocks or start from a template above.</p>
              <button type="button" onClick={addBlock} className="btn-primary btn-sm">
                Add First Block
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {blocks.map((block, index) => (
                <div key={index} className="card relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-primary-600">Block #{index + 1}</span>
                    <button
                      type="button"
                      onClick={() => removeBlock(index)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="label">Block Title *</label>
                      <input
                        className="input"
                        value={block.title}
                        onChange={(e) => updateBlock(index, "title", e.target.value)}
                        required
                        placeholder="e.g., Electrical Rough-In"
                      />
                    </div>
                    <div>
                      <label className="label">Trade Type</label>
                      <select
                        className="input"
                        value={block.trade_type}
                        onChange={(e) => updateBlock(index, "trade_type", e.target.value)}
                      >
                        <option value="">Select trade...</option>
                        {TRADE_TYPES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Description</label>
                      <textarea
                        className="input"
                        rows={2}
                        value={block.description}
                        onChange={(e) => updateBlock(index, "description", e.target.value)}
                        placeholder="Describe the work..."
                      />
                    </div>
                    <div>
                      <label className="label">Desired Completion Date</label>
                      <input
                        className="input"
                        type="date"
                        value={block.desired_completion_date}
                        onChange={(e) => updateBlock(index, "desired_completion_date", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Dependencies</label>
                      <select
                        className="input"
                        multiple
                        value={block.depends_on.map(String)}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions, (o) => Number(o.value));
                          updateBlock(index, "depends_on", selected);
                        }}
                      >
                        {blocks.map((b, i) => {
                          if (i === index) return null;
                          return (
                            <option key={i} value={i}>
                              #{i + 1}: {b.title || "(untitled)"}
                            </option>
                          );
                        })}
                      </select>
                      <p className="text-xs text-gray-400 mt-1">Hold Ctrl/Cmd to select multiple</p>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Special Requirements</label>
                      <input
                        className="input"
                        value={block.special_requirements}
                        onChange={(e) => updateBlock(index, "special_requirements", e.target.value)}
                        placeholder="Any special requirements..."
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || !title || !address || !projectType}
            className="btn-primary"
          >
            {saving ? "Creating..." : "Create Project"}
          </button>
          <Link href="/homeowner" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
