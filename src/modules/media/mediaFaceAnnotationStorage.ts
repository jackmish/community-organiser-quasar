import type { FaceAnnotationRect } from './mediaFaceAnnotationModel';

const STORAGE_KEY = 'co21.mediaFaceAnnotations.v1';

type FaceAnnotationStore = {
  images: Record<string, FaceAnnotationRect[]>;
  knownNames: string[];
};

function emptyStore(): FaceAnnotationStore {
  return { images: {}, knownNames: [] };
}

function readStore(): FaceAnnotationStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<FaceAnnotationStore>;
    return {
      images: parsed.images && typeof parsed.images === 'object' ? parsed.images : {},
      knownNames: Array.isArray(parsed.knownNames)
        ? parsed.knownNames.filter((name) => typeof name === 'string' && name.trim())
        : [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: FaceAnnotationStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function fileImageAnnotationKey(rootPath: string, filePath: string): string {
  return `file:${rootPath}\0${filePath}`;
}

export function directImageAnnotationKey(name: string, imageUrl: string): string {
  return `direct:${name}\0${imageUrl}`;
}

export function loadAnnotationsForImage(imageKey: string): FaceAnnotationRect[] {
  if (!imageKey) return [];
  const store = readStore();
  const rects = store.images[imageKey];
  return Array.isArray(rects) ? rects.map(normalizeRect).filter(Boolean) as FaceAnnotationRect[] : [];
}

export function saveAnnotationsForImage(imageKey: string, rects: FaceAnnotationRect[]): void {
  if (!imageKey) return;
  const store = readStore();
  const normalized = rects.map(normalizeRect).filter(Boolean) as FaceAnnotationRect[];
  store.images[imageKey] = normalized;
  for (const rect of normalized) {
    addKnownNameToStore(store, rect.label);
  }
  writeStore(store);
}

export function loadKnownPersonNames(): string[] {
  const names = readStore().knownNames.map((name) => name.trim()).filter(Boolean);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function rememberPersonName(name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const store = readStore();
  addKnownNameToStore(store, trimmed);
  writeStore(store);
}

export function filterPersonNameHints(query: string, names: string[]): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return names.slice(0, 12);
  return names.filter((name) => name.toLowerCase().includes(q)).slice(0, 12);
}

function addKnownNameToStore(store: FaceAnnotationStore, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  const exists = store.knownNames.some(
    (item) => item.localeCompare(trimmed, undefined, { sensitivity: 'base' }) === 0,
  );
  if (!exists) store.knownNames.push(trimmed);
}

function normalizeRect(rect: Partial<FaceAnnotationRect>): FaceAnnotationRect | null {
  if (!rect || typeof rect !== 'object') return null;
  const label = typeof rect.label === 'string' ? rect.label.trim() : '';
  const id = typeof rect.id === 'string' && rect.id ? rect.id : '';
  const x = num01(rect.x);
  const y = num01(rect.y);
  const width = num01(rect.width);
  const height = num01(rect.height);
  if (!id || width <= 0 || height <= 0) return null;
  return { id, x, y, width, height, label };
}

function num01(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
