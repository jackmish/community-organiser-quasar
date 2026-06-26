import { co21AuthHeaders, requestCo21ApiToken } from 'src/modules/co21-server/co21ApiAuth';
import { co21ApiRequest, type Co21ApiResponse } from 'src/modules/co21-server/co21ApiClient';
import type { FaceAnnotationRect } from 'src/modules/media/mediaFaceAnnotationModel';
import type {
  RecognitionDetection,
  RecognitionMode,
  RecognitionProbe,
  RecognitionProbeSample,
  RecognitionProbeSummary,
  RecognitionSession,
} from './recognitionModel';
import { toRecognitionApiImageKey } from './recognitionImageKey';
import { listLabeledTaskAnnotationEntries } from 'src/modules/media/mediaFaceAnnotationStorage';
import { getMediaFullImageUrl } from 'src/modules/media/mediaFolderService';
import { parseFileImageKey } from './recognitionImageKey';

type SessionSingleOut = { data: RecognitionSession };
type RunOut = {
  results: Array<{
    image_key: string;
    detections: RecognitionDetection[];
    engine?: string;
    error?: string;
  }>;
  pending: RecognitionSession['pending_results'];
};
type AcceptOut = { accepted: RecognitionDetection[] };

function authHeaders(): Promise<Record<string, string>> {
  return co21AuthHeaders();
}

async function requireAuthHeaders(): Promise<Record<string, string> | null> {
  const auth = await requestCo21ApiToken();
  if (!auth.token) return null;
  return { Authorization: `Bearer ${auth.token}` };
}

function apiFailureMessage(res: Co21ApiResponse<unknown>, fallback: string): string {
  if (res.status === 401 || res.status === 403) {
    return 'Recognition API authentication failed';
  }
  if (res.status === 413) {
    return 'Image is too large for the recognition server';
  }
  if (res.status === 404) {
    return fallback;
  }
  if (res.rawBody) {
    try {
      const parsed = JSON.parse(res.rawBody) as {
        detail?: unknown;
        message?: string;
      };
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return parsed.message.trim();
      }
      if (typeof parsed.detail === 'string' && parsed.detail.trim()) {
        return parsed.detail.trim();
      }
      if (Array.isArray(parsed.detail)) {
        const parts = parsed.detail
          .map((item) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object' && 'msg' in item) {
              const msg = (item as { msg?: unknown }).msg;
              return typeof msg === 'string' ? msg : '';
            }
            return '';
          })
          .filter(Boolean);
        if (parts.length) return parts.join('; ');
      }
    } catch {
      /* ignore */
    }
  }
  return fallback;
}

export type ProbeAnnotationInput = {
  apiImageKey: string;
  annotation: FaceAnnotationRect;
};

function probeSlug(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '-');
}

function sampleKey(sample: RecognitionProbeSample): string {
  return `${sample.image_key}:${sample.x}:${sample.y}:${sample.width}:${sample.height}`;
}

export function annotationsToProbes(items: ProbeAnnotationInput[]): RecognitionProbe[] {
  const byLabel = new Map<string, RecognitionProbeSample[]>();
  for (const item of items) {
    const label = String(item.annotation.label || '').trim();
    const apiImageKey = String(item.apiImageKey || '').trim();
    if (!label || !apiImageKey) continue;
    const samples = byLabel.get(label) || [];
    const sample: RecognitionProbeSample = {
      image_key: apiImageKey,
      x: item.annotation.x,
      y: item.annotation.y,
      width: item.annotation.width,
      height: item.annotation.height,
    };
    if (!samples.some((entry) => sampleKey(entry) === sampleKey(sample))) {
      samples.push(sample);
    }
    byLabel.set(label, samples);
  }

  return Array.from(byLabel.entries()).map(([label, samples]) => ({
    id: `probe-${probeSlug(label)}`,
    label,
    samples,
    rects: samples.map(({ x, y, width, height }) => ({ x, y, width, height })),
  }));
}

export function mergeRecognitionProbes(...groups: RecognitionProbe[][]): RecognitionProbe[] {
  const byLabel = new Map<string, RecognitionProbe>();
  for (const group of groups) {
    for (const probe of group) {
      const label = probe.label.trim();
      if (!label) continue;
      const existing = byLabel.get(label);
      if (!existing) {
        byLabel.set(label, {
          id: probe.id || `probe-${probeSlug(label)}`,
          label,
          samples: [...(probe.samples || [])],
          rects: [...(probe.rects || [])],
        });
        continue;
      }
      for (const sample of probe.samples || []) {
        if (!existing.samples.some((entry) => sampleKey(entry) === sampleKey(sample))) {
          existing.samples.push(sample);
        }
      }
      existing.rects = existing.samples.map(({ x, y, width, height }) => ({
        x,
        y,
        width,
        height,
      }));
    }
  }
  return Array.from(byLabel.values());
}

export function summarizeRecognitionProbes(probes: RecognitionProbe[]): RecognitionProbeSummary[] {
  return probes
    .map((probe) => {
      const samples = probe.samples || [];
      const photoCount = new Set(samples.map((sample) => sample.image_key).filter(Boolean)).size;
      return {
        label: probe.label,
        sampleCount: samples.length,
        photoCount,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
}

export async function buildTaskProbesFromStorage(rootPath: string): Promise<RecognitionProbe[]> {
  const entries = listLabeledTaskAnnotationEntries(rootPath);
  const inputs: ProbeAnnotationInput[] = [];
  for (const entry of entries) {
    const apiImageKey = await toRecognitionApiImageKey(entry.localKey);
    if (!apiImageKey) continue;
    for (const annotation of entry.annotations) {
      inputs.push({ apiImageKey, annotation });
    }
  }
  return annotationsToProbes(inputs);
}

export async function resolveTaskSampleImageUrl(localKey: string): Promise<string> {
  const parsed = parseFileImageKey(localKey);
  if (!parsed) throw new Error('Sample image is not from a task folder');
  const result = await getMediaFullImageUrl(parsed.root, parsed.path);
  if (!result.ok) {
    throw new Error(result.error || 'Failed to load sample image');
  }
  return result.url;
}

export async function uploadSessionPhotoByLocalKey(
  sessionId: string,
  localKey: string,
): Promise<RecognitionUploadResult> {
  const apiImageKey = await toRecognitionApiImageKey(localKey);
  if (!apiImageKey) {
    return { ok: false, error: 'Invalid image key for recognition upload' };
  }

  const url = await resolveTaskSampleImageUrl(localKey);
  const payload = await prepareRecognitionImagePayload(url);
  return uploadRecognitionImage(sessionId, apiImageKey, payload.base64, payload.mimeType);
}

export async function uploadProbeSampleImages(
  sessionId: string,
  probes: RecognitionProbe[],
  options: { rootPath: string; skipApiImageKeys?: Set<string> },
): Promise<RecognitionUploadResult> {
  const rootPath = options.rootPath.trim();
  if (!rootPath) {
    return { ok: false, error: 'Task folder is required to upload recognition samples' };
  }

  const skip = options.skipApiImageKeys || new Set<string>();
  const needed = new Set<string>();
  for (const probe of probes) {
    for (const sample of probe.samples || []) {
      if (sample.image_key && !skip.has(sample.image_key)) {
        needed.add(sample.image_key);
      }
    }
  }

  const entries = listLabeledTaskAnnotationEntries(rootPath);
  const localByApiKey = new Map<string, string>();
  for (const entry of entries) {
    const apiKey = await toRecognitionApiImageKey(entry.localKey);
    localByApiKey.set(apiKey, entry.localKey);
  }

  for (const apiImageKey of needed) {
    const localKey = localByApiKey.get(apiImageKey);
    if (!localKey) {
      return {
        ok: false,
        error: 'Missing local photo for a labeled recognition sample',
      };
    }
    const uploaded = await uploadSessionPhotoByLocalKey(sessionId, localKey);
    if (!uploaded.ok) return uploaded;
  }

  return { ok: true, error: '' };
}

export async function buildFullTaskProbes(
  rootPath: string,
  localImageKey: string,
  annotations: FaceAnnotationRect[],
): Promise<RecognitionProbe[]> {
  const taskProbes = await buildTaskProbesFromStorage(rootPath);
  const apiImageKey = await toRecognitionApiImageKey(localImageKey);
  const currentInputs: ProbeAnnotationInput[] = annotations
    .filter((item) => item.label?.trim())
    .map((annotation) => ({ apiImageKey, annotation }));
  const currentProbes = annotationsToProbes(currentInputs);
  return mergeRecognitionProbes(taskProbes, currentProbes);
}

export async function createRecognitionSession(
  taskId: string,
  mode: RecognitionMode = 'face',
): Promise<RecognitionSession | null> {
  const headers = await requireAuthHeaders();
  if (!headers) return null;

  const res = await co21ApiRequest<SessionSingleOut>({
    path: '/api/v1/recognition/sessions',
    method: 'POST',
    headers,
    body: { task_id: taskId, mode },
    timeoutMs: 20_000,
  });
  return res.ok && res.data?.data ? res.data.data : null;
}

export async function getRecognitionSessionByTask(
  taskId: string,
): Promise<RecognitionSession | null> {
  const headers = await requireAuthHeaders();
  if (!headers) return null;

  const res = await co21ApiRequest<SessionSingleOut>({
    path: `/api/v1/recognition/sessions/by-task/${encodeURIComponent(taskId)}`,
    headers,
    timeoutMs: 15_000,
  });
  if (res.status === 404) return null;
  return res.ok && res.data?.data ? res.data.data : null;
}

export async function updateRecognitionProbes(
  sessionId: string,
  probes: RecognitionProbe[],
): Promise<{ session: RecognitionSession | null; error: string }> {
  const headers = await requireAuthHeaders();
  if (!headers) {
    return { session: null, error: 'Recognition API authentication failed' };
  }

  const res = await co21ApiRequest<SessionSingleOut>({
    path: `/api/v1/recognition/sessions/${encodeURIComponent(sessionId)}/probes`,
    method: 'PUT',
    headers,
    body: { probes },
    timeoutMs: 20_000,
  });
  if (res.ok && res.data?.data) {
    return { session: res.data.data, error: '' };
  }
  return {
    session: null,
    error: apiFailureMessage(res, 'Could not update recognition probes'),
  };
}

export type RecognitionUploadResult = {
  ok: boolean;
  error: string;
};

export async function uploadRecognitionImage(
  sessionId: string,
  imageKey: string,
  contentBase64: string,
  mimeType = 'image/jpeg',
): Promise<RecognitionUploadResult> {
  const headers = await requireAuthHeaders();
  if (!headers) {
    return { ok: false, error: 'Recognition API authentication failed' };
  }

  const res = await co21ApiRequest({
    path: `/api/v1/recognition/sessions/${encodeURIComponent(sessionId)}/images`,
    method: 'POST',
    headers,
    body: {
      image_key: imageKey,
      content_base64: contentBase64,
      mime_type: mimeType,
    },
    timeoutMs: 120_000,
  });
  if (res.ok) return { ok: true, error: '' };
  return {
    ok: false,
    error: apiFailureMessage(res, 'Could not upload image to recognition session'),
  };
}

export type RecognitionRunResult = {
  ok: boolean;
  data: RunOut | null;
  error: string;
};

type NormRect = { x: number; y: number; width: number; height: number };

function detectionRect(det: RecognitionDetection): NormRect {
  return { x: det.x, y: det.y, width: det.width, height: det.height };
}

function rectIou(a: NormRect, b: NormRect): number {
  const ax2 = a.x + a.width;
  const ay2 = a.y + a.height;
  const bx2 = b.x + b.width;
  const by2 = b.y + b.height;
  const ix1 = Math.max(a.x, b.x);
  const iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);
  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const inter = iw * ih;
  if (inter <= 0) return 0;
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

function shouldSuppressCandidate(candidate: NormRect, kept: NormRect): boolean {
  if (rectIou(candidate, kept) > 0.1) return true;
  const avgSize = (candidate.width + candidate.height + kept.width + kept.height) / 4;
  if (avgSize <= 0) return false;
  const ccx = candidate.x + candidate.width / 2;
  const ccy = candidate.y + candidate.height / 2;
  const kcx = kept.x + kept.width / 2;
  const kcy = kept.y + kept.height / 2;
  return Math.hypot(ccx - kcx, ccy - kcy) < avgSize * 0.55;
}

function dedupeRecognitionDetections(detections: RecognitionDetection[]): RecognitionDetection[] {
  const ordered = [...detections].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  const kept: RecognitionDetection[] = [];
  for (const candidate of ordered) {
    const crect = detectionRect(candidate);
    if (kept.some((item) => shouldSuppressCandidate(crect, detectionRect(item)))) continue;
    kept.push(candidate);
  }
  return kept;
}

/** Deduplicate overlaps; skip regions the user already labeled. */
export function filterRecognitionDetections(
  detections: RecognitionDetection[],
  options?: {
    existingAnnotations?: FaceAnnotationRect[];
  },
): RecognitionDetection[] {
  const userRects = (options?.existingAnnotations || [])
    .filter((item) => item.label?.trim())
    .map(({ x, y, width, height }) => ({ x, y, width, height }));

  const result = dedupeRecognitionDetections(detections);

  if (!userRects.length) return result;

  return result.filter((det) => {
    const crect = detectionRect(det);
    return !userRects.some((userRect) => rectIou(crect, userRect) > 0.35);
  });
}

export async function runRecognition(
  sessionId: string,
  imageKeys: string[],
  options?: { excludeByImage?: Record<string, NormRect[]> },
): Promise<RecognitionRunResult> {
  const headers = await requireAuthHeaders();
  if (!headers) {
    return { ok: false, data: null, error: 'Recognition API authentication failed' };
  }

  const body: {
    image_keys: string[];
    exclude_by_image?: Record<string, NormRect[]>;
  } = { image_keys: imageKeys };
  if (options?.excludeByImage && Object.keys(options.excludeByImage).length) {
    body.exclude_by_image = options.excludeByImage;
  }

  const res = await co21ApiRequest<RunOut>({
    path: `/api/v1/recognition/sessions/${encodeURIComponent(sessionId)}/recognize`,
    method: 'POST',
    headers,
    body,
    timeoutMs: 90_000,
  });
  if (res.ok && res.data) {
    return { ok: true, data: res.data, error: '' };
  }
  return {
    ok: false,
    data: null,
    error: apiFailureMessage(res, 'Recognition request failed'),
  };
}

export async function acceptRecognitionResults(
  sessionId: string,
  imageKey: string,
  detectionIds?: string[],
): Promise<RecognitionDetection[]> {
  const res = await co21ApiRequest<AcceptOut>({
    path: `/api/v1/recognition/sessions/${encodeURIComponent(sessionId)}/results/accept`,
    method: 'POST',
    headers: await authHeaders(),
    body: {
      image_key: imageKey,
      detection_ids: detectionIds,
    },
    timeoutMs: 20_000,
  });
  return res.ok && res.data?.accepted ? res.data.accepted : [];
}

export async function rejectRecognitionResults(
  sessionId: string,
  imageKey: string,
  detectionIds?: string[],
): Promise<boolean> {
  const res = await co21ApiRequest({
    path: `/api/v1/recognition/sessions/${encodeURIComponent(sessionId)}/results/reject`,
    method: 'POST',
    headers: await authHeaders(),
    body: {
      image_key: imageKey,
      detection_ids: detectionIds,
    },
    timeoutMs: 20_000,
  });
  return res.ok;
}

const RECOGNITION_MAX_EDGE = 2048;
const RECOGNITION_JPEG_QUALITY = 0.85;

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for recognition'));
    img.src = src;
  });
}

/** Downscale large gallery photos before JSON upload (face detection does not need full resolution). */
export async function prepareRecognitionImagePayload(
  url: string,
): Promise<{ base64: string; mimeType: string }> {
  const img = await loadImageElement(url);
  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (!width || !height) {
    throw new Error('Image has no dimensions');
  }

  const maxEdge = Math.max(width, height);
  const scale = maxEdge > RECOGNITION_MAX_EDGE ? RECOGNITION_MAX_EDGE / maxEdge : 1;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  if (scale >= 1 && url.trim().startsWith('data:image/jpeg')) {
    return fetchImageAsBase64(url);
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  return fetchImageAsBase64(canvas.toDataURL('image/jpeg', RECOGNITION_JPEG_QUALITY));
}

export async function fetchImageAsBase64(
  url: string,
): Promise<{ base64: string; mimeType: string }> {
  const trimmed = url.trim();
  if (trimmed.startsWith('data:')) {
    const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/s.exec(trimmed);
    if (!match) throw new Error('Invalid data URL');
    const mimeType = match[1] || 'image/jpeg';
    const payload = match[2] || '';
    if (trimmed.includes(';base64,')) {
      return { base64: payload, mimeType };
    }
    return { base64: btoa(decodeURIComponent(payload)), mimeType };
  }

  const res = await fetch(trimmed);
  if (!res.ok) throw new Error(`Failed to load image (${res.status})`);
  const blob = await res.blob();
  const mimeType = blob.type || 'image/jpeg';
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return { base64: btoa(binary), mimeType };
}

export function detectionsToFaceAnnotations(
  detections: RecognitionDetection[],
): FaceAnnotationRect[] {
  return detections.map((d) => ({
    id: `det-${d.id}`,
    x: d.x,
    y: d.y,
    width: d.width,
    height: d.height,
    label: d.label || d.text || '',
    confidence: d.confidence,
  }));
}
