// Files are stored in the database, so keep them under Vercel's 4.5 MB request limit.
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

export interface Attachment {
  id: number;
  project_id: number;
  block_id: number | null;
  block_title?: string | null;
  filename: string;
  content_type: string;
  size: number;
  created_at: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
