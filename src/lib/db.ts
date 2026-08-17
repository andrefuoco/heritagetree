import { openDB, type IDBPDatabase } from 'idb';
import { DOCUMENT_VERSION, type TreeDocument } from '../types';

const DB_NAME = 'heritage-tree';
const STORE = 'documents';
const CURRENT_KEY = 'current';

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE)) database.createObjectStore(STORE);
    },
  });
  return dbPromise;
}

export async function loadDocument(): Promise<TreeDocument | null> {
  try {
    const raw = await (await db()).get(STORE, CURRENT_KEY);
    return raw ? migrate(raw) : null;
  } catch {
    // A blocked or unavailable IndexedDB (private browsing, quota) must not
    // stop the app from opening — the user simply starts with an empty tree.
    return null;
  }
}

export async function saveDocument(doc: TreeDocument): Promise<void> {
  try {
    await (await db()).put(STORE, doc, CURRENT_KEY);
  } catch {
    /* ignore: the in-memory tree is still usable and can be exported */
  }
}

/** Brings a document read from disk or an import file up to the current shape. */
export function migrate(raw: unknown): TreeDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const doc = raw as Partial<TreeDocument>;
  if (!doc.people || !doc.unions) return null;
  return {
    version: DOCUMENT_VERSION,
    name: doc.name ?? '',
    people: doc.people,
    unions: doc.unions,
    rootPersonId: doc.rootPersonId ?? null,
    surnameColors: doc.surnameColors ?? {},
    updatedAt: doc.updatedAt ?? new Date().toISOString(),
  };
}
