import type { RecognitionDetection } from './recognitionModel';

const STORAGE_KEY = 'co21.recognitionPending.v1';

type PendingStore = {
  images: Record<string, RecognitionDetection[]>;
};

function emptyStore(): PendingStore {
  return { images: {} };
}

function readStore(): PendingStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<PendingStore>;
    return {
      images: parsed.images && typeof parsed.images === 'object' ? parsed.images : {},
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: PendingStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* ignore quota errors */
  }
}

function normalizeDetection(raw: unknown): RecognitionDetection | null {
  if (!raw || typeof raw !== 'object') return null;
  const item = raw as Partial<RecognitionDetection>;
  if (typeof item.id !== 'string' || !item.id.trim()) return null;
  if (typeof item.x !== 'number' || typeof item.y !== 'number') return null;
  if (typeof item.width !== 'number' || typeof item.height !== 'number') return null;
  return {
    id: item.id,
    label: typeof item.label === 'string' ? item.label : '',
    kind: typeof item.kind === 'string' ? item.kind : 'object',
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    confidence: typeof item.confidence === 'number' ? item.confidence : 0,
    text: typeof item.text === 'string' ? item.text : null,
  };
}

export function loadStoredPendingDetections(localImageKey: string): RecognitionDetection[] {
  const key = localImageKey.trim();
  if (!key) return [];
  const store = readStore();
  const entries = store.images[key];
  if (!Array.isArray(entries)) return [];
  return entries.map(normalizeDetection).filter(Boolean) as RecognitionDetection[];
}

export function saveStoredPendingDetections(
  localImageKey: string,
  detections: RecognitionDetection[],
): void {
  const key = localImageKey.trim();
  if (!key) return;
  const store = readStore();
  const normalized = detections
    .map(normalizeDetection)
    .filter(Boolean) as RecognitionDetection[];
  if (normalized.length) {
    store.images[key] = normalized;
  } else {
    delete store.images[key];
  }
  writeStore(store);
}

export function removeStoredPendingDetections(
  localImageKey: string,
  detectionIds?: string[],
): void {
  const key = localImageKey.trim();
  if (!key) return;
  const store = readStore();
  const existing = store.images[key];
  if (!Array.isArray(existing)) return;

  if (!detectionIds?.length) {
    delete store.images[key];
    writeStore(store);
    return;
  }

  const remove = new Set(detectionIds);
  const next = existing.filter((item) => !remove.has(item.id));
  if (next.length) {
    store.images[key] = next;
  } else {
    delete store.images[key];
  }
  writeStore(store);
}

export function clearAllStoredPendingDetections(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
