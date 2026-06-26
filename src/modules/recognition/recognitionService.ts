import { co21AuthHeaders, requestCo21ApiToken } from 'src/modules/co21-server/co21ApiAuth';
import { co21ApiRequest, type Co21ApiResponse } from 'src/modules/co21-server/co21ApiClient';
import type { FaceAnnotationRect } from 'src/modules/media/mediaFaceAnnotationModel';
import type {
  RecognitionDetection,
  RecognitionMode,
  RecognitionProbe,
  RecognitionSession,
} from './recognitionModel';

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

export function annotationsToProbes(annotations: FaceAnnotationRect[]): RecognitionProbe[] {
  const byLabel = new Map<string, RecognitionProbe['rects']>();
  for (const item of annotations) {
    const label = String(item.label || '').trim();
    if (!label) continue;
    const rects = byLabel.get(label) || [];
    rects.push({
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
    });
    byLabel.set(label, rects);
  }
  return Array.from(byLabel.entries()).map(([label, rects]) => ({
    id: `probe-${label.toLowerCase().replace(/\s+/g, '-')}`,
    label,
    rects,
  }));
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
): Promise<RecognitionSession | null> {
  const headers = await requireAuthHeaders();
  if (!headers) return null;

  const res = await co21ApiRequest<SessionSingleOut>({
    path: `/api/v1/recognition/sessions/${encodeURIComponent(sessionId)}/probes`,
    method: 'PUT',
    headers,
    body: { probes },
    timeoutMs: 20_000,
  });
  return res.ok && res.data?.data ? res.data.data : null;
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

export async function runRecognition(
  sessionId: string,
  imageKeys: string[],
): Promise<RunOut | null> {
  const headers = await requireAuthHeaders();
  if (!headers) return null;

  const res = await co21ApiRequest<RunOut>({
    path: `/api/v1/recognition/sessions/${encodeURIComponent(sessionId)}/recognize`,
    method: 'POST',
    headers,
    body: { image_keys: imageKeys },
    timeoutMs: 90_000,
  });
  return res.ok && res.data ? res.data : null;
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

export function mergeRecognitionProbes(
  ...groups: RecognitionProbe[][]
): RecognitionProbe[] {
  const byLabel = new Map<string, RecognitionProbe>();
  for (const group of groups) {
    for (const probe of group) {
      const label = probe.label.trim();
      if (!label) continue;
      const existing = byLabel.get(label);
      if (!existing) {
        byLabel.set(label, {
          id: probe.id,
          label,
          rects: [...probe.rects],
        });
        continue;
      }
      existing.rects.push(...probe.rects);
    }
  }
  return Array.from(byLabel.values());
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
  }));
}
