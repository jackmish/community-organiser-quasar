import { co21AuthHeaders } from 'src/modules/ai/co21ApiAuth';
import { co21ApiRequest } from 'src/modules/ai/co21ApiClient';
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
  const res = await co21ApiRequest<SessionSingleOut>({
    path: '/api/v1/recognition/sessions',
    method: 'POST',
    headers: await authHeaders(),
    body: { task_id: taskId, mode },
    timeoutMs: 20_000,
  });
  return res.ok && res.data?.data ? res.data.data : null;
}

export async function getRecognitionSessionByTask(
  taskId: string,
): Promise<RecognitionSession | null> {
  const res = await co21ApiRequest<SessionSingleOut>({
    path: `/api/v1/recognition/sessions/by-task/${encodeURIComponent(taskId)}`,
    headers: await authHeaders(),
    timeoutMs: 15_000,
  });
  return res.ok && res.data?.data ? res.data.data : null;
}

export async function updateRecognitionProbes(
  sessionId: string,
  probes: RecognitionProbe[],
): Promise<RecognitionSession | null> {
  const res = await co21ApiRequest<SessionSingleOut>({
    path: `/api/v1/recognition/sessions/${encodeURIComponent(sessionId)}/probes`,
    method: 'PUT',
    headers: await authHeaders(),
    body: { probes },
    timeoutMs: 20_000,
  });
  return res.ok && res.data?.data ? res.data.data : null;
}

export async function uploadRecognitionImage(
  sessionId: string,
  imageKey: string,
  contentBase64: string,
  mimeType = 'image/jpeg',
): Promise<boolean> {
  const res = await co21ApiRequest({
    path: `/api/v1/recognition/sessions/${encodeURIComponent(sessionId)}/images`,
    method: 'POST',
    headers: await authHeaders(),
    body: {
      image_key: imageKey,
      content_base64: contentBase64,
      mime_type: mimeType,
    },
    timeoutMs: 60_000,
  });
  return res.ok;
}

export async function runRecognition(
  sessionId: string,
  imageKeys: string[],
): Promise<RunOut | null> {
  const res = await co21ApiRequest<RunOut>({
    path: `/api/v1/recognition/sessions/${encodeURIComponent(sessionId)}/recognize`,
    method: 'POST',
    headers: await authHeaders(),
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

export async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
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
