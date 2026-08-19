import type { TreeDocument } from '../types';
import { migrate } from './db';

function slugify(value: string, fallback: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || fallback;
}

/**
 * Writes the tree out as a plain JSON file. This is the app's backup and
 * device-transfer mechanism — the data otherwise never leaves the browser.
 */
export function exportDocument(doc: TreeDocument, fallbackName: string): void {
  const payload = JSON.stringify(doc, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const date = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slugify(doc.name, slugify(fallbackName, 'heritage-tree'))}-${date}.json`;
  document.body.appendChild(link);
  link.click();
  // Revoking synchronously can cancel the download before the browser has
  // started reading the blob, so let the current task finish first.
  setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 0);
}

export async function readImportFile(file: File): Promise<TreeDocument | null> {
  try {
    return migrate(JSON.parse(await file.text()));
  } catch {
    return null;
  }
}
