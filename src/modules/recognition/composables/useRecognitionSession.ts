import { ref, watch, type Ref } from 'vue';
import type { FaceAnnotationRect } from 'src/modules/media/mediaFaceAnnotationModel';
import { createFaceAnnotationId } from 'src/modules/media/mediaFaceAnnotationModel';
import type { RecognitionDetection, RecognitionSession } from '../recognitionModel';
import {
  acceptRecognitionResults,
  annotationsToProbes,
  createRecognitionSession,
  detectionsToFaceAnnotations,
  fetchImageAsBase64,
  getRecognitionSessionByTask,
  rejectRecognitionResults,
  runRecognition,
  updateRecognitionProbes,
  uploadRecognitionImage,
} from '../recognitionService';

export function useRecognitionSession(taskId: Ref<string>) {
  const session = ref<RecognitionSession | null>(null);
  const busy = ref(false);
  const lastError = ref('');
  const showPending = ref(false);
  const pendingDetections = ref<RecognitionDetection[]>([]);

  function clearPending(): void {
    pendingDetections.value = [];
  }

  function loadPendingFromSession(
    nextSession: RecognitionSession | null,
    imageKey: string,
  ): void {
    if (!nextSession || !imageKey) {
      clearPending();
      return;
    }
    const entry = nextSession.pending_results?.[imageKey];
    pendingDetections.value = Array.isArray(entry?.detections) ? [...entry.detections] : [];
  }

  async function ensureSession(mode: 'face' | 'ocr' | 'general' = 'face'): Promise<RecognitionSession | null> {
    const id = String(taskId.value || '').trim();
    if (!id) {
      lastError.value = 'Task id is required for recognition session';
      return null;
    }

    if (session.value && session.value.task_id === id) {
      return session.value;
    }

    busy.value = true;
    lastError.value = '';
    try {
      const existing = await getRecognitionSessionByTask(id);
      if (existing) {
        session.value = existing;
        return existing;
      }
      const created = await createRecognitionSession(id, mode);
      session.value = created;
      if (!created) lastError.value = 'Could not create recognition session';
      return created;
    } finally {
      busy.value = false;
    }
  }

  async function syncProbes(annotations: FaceAnnotationRect[]): Promise<void> {
    const current = session.value || (await ensureSession('face'));
    if (!current) return;

    const probes = annotationsToProbes(annotations);
    if (!probes.length) return;

    busy.value = true;
    lastError.value = '';
    try {
      const updated = await updateRecognitionProbes(current.session_id, probes);
      if (updated) session.value = updated;
      else lastError.value = 'Could not update recognition probes';
    } finally {
      busy.value = false;
    }
  }

  async function recognizeImage(
    imageKey: string,
    imageUrl: string,
    annotations: FaceAnnotationRect[],
  ): Promise<RecognitionDetection[]> {
    const current = await ensureSession('face');
    if (!current || !imageKey || !imageUrl) return [];

    busy.value = true;
    lastError.value = '';
    try {
      if (annotations.length) {
        await updateRecognitionProbes(current.session_id, annotationsToProbes(annotations));
      }

      const { base64, mimeType } = await fetchImageAsBase64(imageUrl);
      const uploaded = await uploadRecognitionImage(
        current.session_id,
        imageKey,
        base64,
        mimeType,
      );
      if (!uploaded) {
        lastError.value = 'Could not upload image to recognition session';
        return [];
      }

      const result = await runRecognition(current.session_id, [imageKey]);
      if (!result) {
        lastError.value = 'Recognition request failed';
        return [];
      }

      session.value = {
        ...current,
        pending_results: result.pending,
      };
      const row = result.results.find((item) => item.image_key === imageKey);
      const detections = row?.detections || [];
      pendingDetections.value = [...detections];
      showPending.value = detections.length > 0;
      return detections;
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : String(err);
      return [];
    } finally {
      busy.value = false;
    }
  }

  async function acceptPending(
    imageKey: string,
    detectionIds?: string[],
  ): Promise<FaceAnnotationRect[]> {
    const current = session.value;
    if (!current || !imageKey) return [];

    const accepted = await acceptRecognitionResults(
      current.session_id,
      imageKey,
      detectionIds,
    );
    if (detectionIds?.length) {
      const remove = new Set(detectionIds);
      pendingDetections.value = pendingDetections.value.filter((d) => !remove.has(d.id));
    } else {
      pendingDetections.value = [];
    }
    if (!pendingDetections.value.length) showPending.value = false;

    return detectionsToFaceAnnotations(accepted).map((item) => ({
      ...item,
      id: createFaceAnnotationId(),
    }));
  }

  async function rejectPending(imageKey: string, detectionIds?: string[]): Promise<void> {
    const current = session.value;
    if (!current || !imageKey) return;

    await rejectRecognitionResults(current.session_id, imageKey, detectionIds);
    if (detectionIds?.length) {
      const remove = new Set(detectionIds);
      pendingDetections.value = pendingDetections.value.filter((d) => !remove.has(d.id));
    } else {
      pendingDetections.value = [];
    }
    if (!pendingDetections.value.length) showPending.value = false;
  }

  watch(taskId, () => {
    session.value = null;
    clearPending();
    showPending.value = false;
    lastError.value = '';
  });

  return {
    session,
    busy,
    lastError,
    showPending,
    pendingDetections,
    ensureSession,
    syncProbes,
    recognizeImage,
    acceptPending,
    rejectPending,
    loadPendingFromSession,
    clearPending,
  };
}
