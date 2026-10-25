"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Attachment, MAX_ATTACHMENT_BYTES, formatFileSize } from "@/lib/attachments";
import { FileText, Image as ImageIcon, Paperclip, Trash2, Upload } from "lucide-react";

// Lists a project's files. blockId: a block's own files, null: project-level files, "all": everything.
// includeProjectFiles adds the project-level files to a block's list.
export function Attachments({
  projectId,
  blockId,
  includeProjectFiles = false,
  canEdit = false,
  title = "Files",
  emptyText = "No files yet.",
  className = "",
}: {
  projectId: number;
  blockId: number | null | "all";
  includeProjectFiles?: boolean;
  canEdit?: boolean;
  title?: string;
  emptyText?: string;
  className?: string;
}) {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetch(`/api/attachments?project_id=${projectId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((all: Attachment[]) => {
        setFiles(
          blockId === "all"
            ? all
            : all.filter((f) => (f.block_id ?? null) === blockId || (includeProjectFiles && f.block_id == null))
        );
      })
      .catch(() => {});
  }, [projectId, blockId, includeProjectFiles]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setError("");
    setUploading(true);
    for (const file of Array.from(list)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(`${file.name} is larger than 4 MB.`);
        continue;
      }
      const form = new FormData();
      form.append("file", file);
      form.append("project_id", String(projectId));
      if (typeof blockId === "number") form.append("block_id", String(blockId));
      const res = await fetch("/api/attachments", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `Could not upload ${file.name}.`);
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    load();
  };

  const remove = async (file: Attachment) => {
    if (!window.confirm(`Remove ${file.filename}?`)) return;
    await fetch(`/api/attachments/${file.id}`, { method: "DELETE" });
    load();
  };

  if (!canEdit && files.length === 0) return null;

  const showSource = blockId === "all" || includeProjectFiles;

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-medium text-gray-400 uppercase flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5" />
          {title} {files.length > 0 && `(${files.length})`}
        </p>
        {canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => upload(e.target.files)}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="btn-secondary btn-sm flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              {uploading ? "Uploading..." : "Add files"}
            </button>
          </>
        )}
      </div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      {files.length === 0 ? (
        <p className="text-sm text-gray-500">{emptyText}</p>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-2">
          {files.map((file) => {
            const isImage = file.content_type.startsWith("image/") && file.content_type !== "image/svg+xml";
            return (
              <li key={file.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-2 min-w-0">
                <a
                  href={`/api/attachments/${file.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 min-w-0 flex-1 group"
                >
                  {isImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/attachments/${file.id}`} alt="" className="w-10 h-10 rounded object-cover bg-gray-100 shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center shrink-0">
                      {file.content_type.startsWith("image/") ? (
                        <ImageIcon className="w-5 h-5 text-gray-400" />
                      ) : (
                        <FileText className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate group-hover:text-primary-600">{file.filename}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {formatFileSize(file.size)}
                      {showSource && (file.block_title ? ` · ${file.block_title}` : " · Whole project")}
                    </p>
                  </div>
                </a>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => remove(file)}
                    className="p-1.5 text-gray-400 hover:text-red-500 shrink-0"
                    aria-label={`Remove ${file.filename}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
