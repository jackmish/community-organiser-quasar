import { computed, ref, watch, type Ref } from 'vue';
import type { FaceAnnotationRect } from 'src/modules/media/mediaFaceAnnotationModel';
import { createFaceAnnotationId } from 'src/modules/media/mediaFaceAnnotationModel';
import type { RecognitionDetection, RecognitionProbe, RecognitionSession } from '../recognitionModel';
import { toRecognitionApiImageKey } from '../recognitionImageKey';
import {
  acceptRecognitionResults,
  annotationsToProbes,
  buildFullTaskProbes,
  createRecognitionSession,
  detectionsToFaceAnnotations,
  getRecognitionSessionByTask,
  prepareRecognitionImagePayload,
  rejectRecognitionResults,
  runRecognition,
  summarizeRecognitionProbes,
  updateRecognitionProbes,
  uploadProbeSampleImages,
  uploadRecognitionImage,
} from '../recognitionService';
import { requestCo21ApiToken } from 'src/modules/co21-server/co21ApiAuth';

function normalizeSessionProbes(probes: RecognitionProbe[]): RecognitionProbe[] {
  return probes.map((probe) => {
    const samples = probe.samples?.length
      ? probe.samples
      : (probe.rects || [])
          .filter((rect) => typeof (rect as { image_key?: string }).image_key === 'string')
          .map((rect) => ({
            image_key: String((rect as { image_key?: string }).image_key || ''),
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          }))
          .filter((sample) => sample.image_key);

    return {
      id: probe.id,
      label: probe.label,
      samples,
      rects: probe.rects || samples.map(({ x, y, width, height }) => ({ x, y, width, height })),
    };
  });
}

export function useRecognitionSession(taskId: Ref<string>, mediaRoot?: Ref<string>) {
  const session = ref<RecognitionSession | null>(null);
  const busy = ref(false);
  const lastError = ref('');
  const showPending = ref(false);
  const pendingDetections = ref<RecognitionDetection[]>([]);
  const lastEngine = ref('');

  const probeSummary = computed(() =>
    summarizeRecognitionProbes(normalizeSessionProbes(session.value?.probes ?? [])),
  );

  const totalSampleCount = computed(() =>
    probeSummary.value.reduce((sum, row) => sum + row.sampleCount, 0),
  );

  function clearPending(): void {
    pendingDetections.value = [];
  }

  async function loadPendingFromSession(
    nextSession: RecognitionSession | null,
    localImageKey: string,
  ): Promise<void> {
    if (!nextSession || !localImageKey) {
      clearPending();
      return;
    }
    const apiImageKey = await toRecognitionApiImageKey(localImageKey);
    const entry = nextSession.pending_results?.[apiImageKey];
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
      const auth = await requestCo21ApiToken();
      if (!auth.token) {
        lastError.value = auth.error || 'Could not authenticate with CO21 backend server';
        return null;
      }

      const existing = await getRecognitionSessionByTask(id);
      if (existing) {
        session.value = {
          ...existing,
          probes: normalizeSessionProbes(existing.probes || []),
        };
        return session.value;
      }
      const created = await createRecognitionSession(id, mode);
      session.value = created
        ? { ...created, probes: normalizeSessionProbes(created.probes || []) }
        : null;
      if (!created) lastError.value = 'Could not create recognition session';
      return session.value;
    } finally {
      busy.value = false;
    }
  }

  async function syncProbes(
    localImageKey: string,
    annotations: FaceAnnotationRect[],
  ): Promise<void> {
    const current = session.value || (await ensureSession('face'));
    const rootPath = String(mediaRoot?.value || '').trim();
    if (!current || !rootPath || !localImageKey) return;

    const probes = await buildFullTaskProbes(rootPath, localImageKey, annotations);
    if (!probes.length) return;

    busy.value = true;
    lastError.value = '';
    try {
      const updated = await updateRecognitionProbes(current.session_id, probes);
      if (updated.session) {
        session.value = {
          ...updated.session,
          probes: normalizeSessionProbes(updated.session.probes || []),
        };
      } else {
        lastError.value = updated.error || 'Could not update recognition probes';
      }
    } finally {
      busy.value = false;
    }
  }

  async function recognizeImage(
    localImageKey: string,
    imageUrl: string,
    annotations: FaceAnnotationRect[],
  ): Promise<RecognitionDetection[]> {
    const current = await ensureSession('face');
    const rootPath = String(mediaRoot?.value || '').trim();
    if (!current || !localImageKey || !imageUrl) return [];

    const apiImageKey = await toRecognitionApiImageKey(localImageKey);
    if (!apiImageKey) {
      lastError.value = 'Invalid image key for recognition';
      return [];
    }

    busy.value = true;
    lastError.value = '';
    lastEngine.value = '';
    try {
      const probes = rootPath
        ? await buildFullTaskProbes(rootPath, localImageKey, annotations)
        : annotationsToProbes(
            annotations
              .filter((item) => item.label?.trim())
              .map((annotation) => ({ apiImageKey, annotation })),
          );

      if (!probes.length) {
        lastError.value = 'Label at least one object on a photo in this task first';
        return [];
      }

      const updated = await updateRecognitionProbes(current.session_id, probes);
      if (updated.session) {
        session.value = {
          ...updated.session,
          probes: normalizeSessionProbes(updated.session.probes || []),
        };
      } else {
        lastError.value = updated.error || 'Could not update recognition probes';
        return [];
      }

      if (rootPath) {
        const sampleUpload = await uploadProbeSampleImages(current.session_id, probes, {
          rootPath,
          skipApiImageKeys: new Set([apiImageKey]),
        });
        if (!sampleUpload.ok) {
          lastError.value = sampleUpload.error || 'Could not upload recognition samples';
          return [];
        }
      }

      const { base64, mimeType } = await prepareRecognitionImagePayload(imageUrl);
      const uploaded = await uploadRecognitionImage(
        current.session_id,
        apiImageKey,
        base64,
        mimeType,
      );
      if (!uploaded.ok) {
        lastError.value = uploaded.error || 'Could not upload image to recognition session';
        return [];
      }

      const result = await runRecognition(current.session_id, [apiImageKey]);
      if (!result.ok || !result.data) {
        lastError.value = result.error || 'Recognition request failed';
        return [];
      }

      const row = result.data.results.find((item) => item.image_key === apiImageKey);
      lastEngine.value = row?.engine || '';

      session.value = {
        ...current,
        probes: session.value?.probes || probes,
        pending_results: result.data.pending,
      };
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
    localImageKey: string,
    detectionIds?: string[],
  ): Promise<FaceAnnotationRect[]> {
    const current = session.value;
    if (!current || !localImageKey) return [];

    const apiImageKey = await toRecognitionApiImageKey(localImageKey);
    const accepted = await acceptRecognitionResults(
      current.session_id,
      apiImageKey,
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

  async function rejectPending(localImageKey: string, detectionIds?: string[]): Promise<void> {
    const current = session.value;
    if (!current || !localImageKey) return;

    const apiImageKey = await toRecognitionApiImageKey(localImageKey);
    await rejectRecognitionResults(current.session_id, apiImageKey, detectionIds);
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
    lastEngine.value = '';
  });

  return {
    session,
    busy,
    lastError,
    lastEngine,
    showPending,
    pendingDetections,
    probeSummary,
    totalSampleCount,
    ensureSession,
    syncProbes,
    recognizeImage,
    acceptPending,
    rejectPending,
    loadPendingFromSession,
    clearPending,
  };
}
