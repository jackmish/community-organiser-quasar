<template>
  <Teleport to="body">
    <q-dialog
      :model-value="open"
      maximized
      seamless
      class="media-gallery-preview-dialog"
      transition-show="fade"
      transition-hide="fade"
      @update:model-value="onDialogToggle"
    >
      <div class="media-gallery-preview" @click="close">
        <div ref="stageEl" class="media-gallery-preview__stage" @click.stop="onStageClick">
          <div
            v-if="mountHint"
            class="media-gallery-preview__forbidden media-gallery-preview__forbidden--overlay"
          >
            <q-icon name="sd_storage" size="42px" color="white" />
            <div class="media-gallery-preview__forbidden-text">{{ mountHintMessage }}</div>
            <q-btn
              v-if="mountHint.canTryMount"
              unelevated
              color="primary"
              icon="sd_storage"
              :label="$text('files.partition_try_mount')"
              :loading="mountBusy"
              class="q-mt-md"
              @click.stop="emitTryMount"
            />
          </div>
          <img
            v-if="imageUrl"
            ref="imageEl"
            :src="imageUrl"
            class="media-gallery-preview__image"
            :class="{ 'media-gallery-preview__image--loading': loading }"
            :alt="displayName"
            @error="onImageError"
            @click.stop
          />
          <q-spinner v-else color="white" size="48px" />
          <q-spinner
            v-if="loading && imageUrl"
            color="white"
            size="32px"
            class="media-gallery-preview__loading"
          />
          <MediaFaceRecognitionOverlay
            v-if="faceRecognitionEnabled && imageUrl"
            :enabled="faceRecognitionEnabled"
            :select-mode="faceRecognitionSelectMode"
            :annotations="faceRecognitionAnnotations"
            :suggested-annotations="suggestedFaceAnnotations"
            :show-suggested="recognitionShowPending"
            :known-names="faceRecognitionKnownNames"
            :stage-el="stageEl"
            :image-el="imageEl"
            @add="onFaceAnnotationAdded"
            @update="onFaceAnnotationUpdated"
            @cancel-select="onFaceSelectCancel"
            @remove="removeFaceAnnotation($event)"
            @accept-suggested="onAcceptSuggested($event)"
            @reject-suggested="onRejectSuggested($event)"
          />
        </div>

        <button
          v-if="hasMultiple"
          type="button"
          class="media-gallery-preview__nav media-gallery-preview__nav--prev"
          :title="prevLoopHint ? $text('files.gallery_preview_loop') : $text('files.gallery_preview_prev')"
          :aria-label="prevLoopHint ? $text('files.gallery_preview_loop') : $text('files.gallery_preview_prev')"
          @click.stop="goPrev"
        >
          <span v-if="prevLoopHint" class="media-gallery-preview__nav-loop">{{ $text('files.gallery_preview_loop') }}</span>
          <q-icon name="chevron_left" size="56px" />
        </button>
        <button
          v-if="hasMultiple"
          type="button"
          class="media-gallery-preview__nav media-gallery-preview__nav--next"
          :title="nextLoopHint ? $text('files.gallery_preview_loop') : $text('files.gallery_preview_next')"
          :aria-label="nextLoopHint ? $text('files.gallery_preview_loop') : $text('files.gallery_preview_next')"
          @click.stop="goNext"
        >
          <q-icon name="chevron_right" size="56px" />
          <span v-if="nextLoopHint" class="media-gallery-preview__nav-loop">{{ $text('files.gallery_preview_loop') }}</span>
        </button>

        <div class="media-gallery-preview__header">
          <div class="media-gallery-preview__header-start">
            <div class="media-gallery-preview__title ellipsis">{{ displayName }}</div>
            <span v-if="positionLabel" class="media-gallery-preview__position">{{ positionLabel }}</span>
            <div
              v-if="imageUrl"
              class="media-gallery-preview__face-tools"
              :class="{ 'media-gallery-preview__face-tools--active': faceRecognitionEnabled }"
            >
              <q-btn
                flat
                round
                class="media-gallery-preview__face-toggle"
                :class="{ 'media-gallery-preview__face-toggle--on': faceRecognitionEnabled }"
                :aria-label="$text('files.face_recognition_toggle')"
                :title="$text('files.face_recognition_toggle')"
                @click.stop="toggleFaceRecognitionEnabled()"
              >
                <q-icon
                  :name="faceRecognitionEnabled ? 'face' : 'face_retouching_off'"
                  :color="faceRecognitionEnabled ? 'amber-4' : 'white'"
                  size="34px"
                />
              </q-btn>
              <MediaFaceRecognitionPanel
                v-if="faceRecognitionEnabled"
                :select-mode="faceRecognitionSelectMode"
                :ai-bridge-available="aiBridgeAvailable"
                :ai-enabled="aiEnabled"
                :ai-healthy="aiHealthy"
                :ai-busy="aiBusy"
                :recognition-available="recognitionAvailable"
                :recognition-busy="recognitionBusy"
                :has-pending="hasPendingDetections"
                :show-pending="recognitionShowPending"
                :probe-summary="probeSummary"
                :total-sample-count="totalSampleCount"
                :recognition-engine="recognitionLastEngine"
                @toggle-select="toggleFaceRecognitionSelectMode()"
                @start-backend-server="onStartBackendServer"
                @auto-recognize="onAutoRecognize"
                @toggle-pending="toggleRecognitionPending()"
              />
            </div>
          </div>
          <q-btn
            flat
            round
            dense
            icon="close"
            color="white"
            :aria-label="$text('action.close')"
            @click.stop="close"
          />
        </div>
        <MediaGalleryTagActions
          v-if="!useDirectUrls && entry && rootPath"
          :root-path="rootPath"
          :file-path="entry.path"
          :tags="tags"
          class="media-gallery-preview__tags"
          @moved="onTagged"
          @error="onTagError"
        />
      </div>
    </q-dialog>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { $text } from 'src/modules/lang';
import { getMediaFullImageUrl, type MediaFolderEntry } from '../mediaFolderService';
import type { MediaFolderMountHint } from '../unixPartitionMountModel';
import MediaGalleryTagActions from './MediaGalleryTagActions.vue';
import MediaFaceRecognitionOverlay from './MediaFaceRecognitionOverlay.vue';
import MediaFaceRecognitionPanel from './MediaFaceRecognitionPanel.vue';
import type { MediaGalleryTagDefinition } from '../mediaGalleryTagModel';
import type { DirectGalleryPreviewEntry } from '../mediaGalleryPreviewTypes';
import { useMediaFaceRecognition } from '../composables/useMediaFaceRecognition';
import {
  directImageAnnotationKey,
  fileImageAnnotationKey,
} from '../mediaFaceAnnotationStorage';
import type { FaceAnnotationRect } from '../mediaFaceAnnotationModel';
import { useCo21Server } from 'src/modules/co21-server/composables/useCo21Server';
import { ensureCo21ServerRunning } from 'src/modules/co21-server/co21ServerService';
import { useRecognitionSession } from 'src/modules/recognition/composables/useRecognitionSession';
import {
  detectionsToFaceAnnotations,
} from 'src/modules/recognition/recognitionService';
import { appNotify } from 'src/utils/appNotify';

const props = withDefaults(
  defineProps<{
    open: boolean;
    rootPath?: string;
    entry?: MediaFolderEntry | null;
    entries?: MediaFolderEntry[];
    tags?: MediaGalleryTagDefinition[];
    fallbackThumbUrl?: string;
    directEntries?: DirectGalleryPreviewEntry[];
    directEntry?: DirectGalleryPreviewEntry | null;
    /** Task id scopes backend recognition session (one session per task). */
    taskId?: string;
    mountHint?: MediaFolderMountHint | null;
    mountBusy?: boolean;
  }>(),
  {
    rootPath: '',
    entry: null,
    tags: () => [],
    directEntries: () => [],
    directEntry: null,
    taskId: '',
    mountHint: null,
    mountBusy: false,
  },
);

const emit = defineEmits<{
  'update:open': [value: boolean];
  'update:entry': [entry: MediaFolderEntry];
  'update:directEntry': [entry: DirectGalleryPreviewEntry];
  moved: [];
  error: [message: string];
  'try-mount': [];
  'probe-mount': [];
}>();

const imageUrl = ref('');
const loading = ref(false);
const stageEl = ref<HTMLElement | null>(null);
const imageEl = ref<HTMLImageElement | null>(null);
let loadGen = 0;

const useDirectUrls = computed(() => (props.directEntries?.length ?? 0) > 0);

const imageAnnotationKey = computed(() => {
  if (useDirectUrls.value) {
    const entry = props.directEntry;
    if (!entry) return '';
    return directImageAnnotationKey(entry.name, entry.imageUrl);
  }
  const entry = props.entry;
  const root = String(props.rootPath || '').trim();
  if (!entry || !root) return '';
  return fileImageAnnotationKey(root, entry.path);
});

const {
  enabled: faceRecognitionEnabled,
  selectMode: faceRecognitionSelectMode,
  annotations: faceRecognitionAnnotations,
  knownNames: faceRecognitionKnownNames,
  toggleEnabled: toggleFaceRecognitionEnabled,
  toggleSelectMode: toggleFaceRecognitionSelectMode,
  addAnnotation: addFaceAnnotation,
  updateAnnotation: updateFaceAnnotation,
  removeAnnotation: removeFaceAnnotation,
} = useMediaFaceRecognition(imageAnnotationKey);

const {
  bridgeAvailable: aiBridgeAvailable,
  enabled: aiEnabled,
  healthy: aiHealthy,
  busy: aiBusy,
  lastError: aiLastError,
  refresh: refreshCo21Server,
  start: startCo21Server,
} = useCo21Server();

const taskIdRef = computed(() => String(props.taskId || '').trim());
const mediaRootRef = computed(() => String(props.rootPath || '').trim());
const {
  busy: recognitionBusy,
  lastError: recognitionLastError,
  lastEngine: recognitionLastEngine,
  showPending: recognitionShowPending,
  pendingDetections,
  probeSummary,
  totalSampleCount,
  recognizeImage,
  acceptPending,
  rejectPending,
  loadPendingFromSession,
  ensureSession,
  syncProbes,
} = useRecognitionSession(taskIdRef, mediaRootRef);

const recognitionAvailable = computed(
  () => !!taskIdRef.value && aiHealthy.value && !!imageUrl.value,
);

const hasPendingDetections = computed(() => pendingDetections.value.length > 0);

const suggestedFaceAnnotations = computed(() =>
  detectionsToFaceAnnotations(pendingDetections.value),
);

function toggleRecognitionPending(): void {
  recognitionShowPending.value = !recognitionShowPending.value;
}

function detectionIdFromSuggestedRectId(rectId: string): string {
  return rectId.startsWith('det-') ? rectId.slice(4) : rectId;
}

const displayName = computed(() => {
  if (useDirectUrls.value) return props.directEntry?.name || '';
  return props.entry?.name || '';
});

const mountHintMessage = computed(() => {
  const hint = props.mountHint;
  if (!hint) return '';
  if (hint.reason === 'not_mounted') {
    return `${$text('files.partition_not_mounted')} ${hint.mountLabel} (${hint.mountPoint})`;
  }
  if (hint.reason === 'permission_denied') {
    return `${$text('files.partition_permission_denied')} ${hint.mountLabel}`;
  }
  if (hint.reason === 'missing_binding') {
    return `${$text('files.partition_forbidden')} ${$text('files.partition_try_mount_hint')}`;
  }
  return $text('files.partition_forbidden');
});

function emitTryMount(): void {
  emit('try-mount');
}

function directEntryKey(item: DirectGalleryPreviewEntry): string {
  return `${item.name}\0${item.imageUrl}`;
}

const currentIndex = computed(() => {
  if (useDirectUrls.value) {
    const entry = props.directEntry;
    if (!entry) return -1;
    const key = directEntryKey(entry);
    return props.directEntries?.findIndex((item) => directEntryKey(item) === key) ?? -1;
  }
  const entry = props.entry;
  if (!entry) return -1;
  return props.entries?.findIndex((item) => item.path === entry.path) ?? -1;
});

const totalCount = computed(() => {
  if (useDirectUrls.value) return props.directEntries?.length ?? 0;
  return props.entries?.length ?? 0;
});

const hasMultiple = computed(() => totalCount.value > 1);

const prevLoopHint = computed(() => hasMultiple.value && currentIndex.value === 0);

const nextLoopHint = computed(
  () => hasMultiple.value && currentIndex.value === totalCount.value - 1,
);

const positionLabel = computed(() => {
  const idx = currentIndex.value;
  const total = totalCount.value;
  if (idx < 0 || total <= 1) return '';
  return `${idx + 1} / ${total}`;
});

async function loadFullImage(): Promise<void> {
  if (useDirectUrls.value) {
    const entry = props.directEntry;
    if (!props.open || !entry?.imageUrl) {
      imageUrl.value = '';
      loading.value = false;
      return;
    }
    loading.value = false;
    imageUrl.value = entry.imageUrl;
    return;
  }

  const entry = props.entry;
  const root = String(props.rootPath || '').trim();
  if (!props.open || !entry || !root) {
    imageUrl.value = '';
    loading.value = false;
    return;
  }

  const gen = ++loadGen;
  loading.value = true;
  imageUrl.value = props.fallbackThumbUrl || '';
  const result = await getMediaFullImageUrl(root, entry.path);
  if (gen !== loadGen) return;
  loading.value = false;
  if (!result.ok) {
    if (!imageUrl.value) {
      emit('error', result.error || $text('files.gallery_preview_failed'));
      emit('probe-mount');
    }
    return;
  }
  imageUrl.value = result.url;
}

function onImageError(): void {
  if (props.fallbackThumbUrl && imageUrl.value !== props.fallbackThumbUrl) {
    imageUrl.value = props.fallbackThumbUrl;
    return;
  }
  emit('error', $text('files.gallery_preview_failed'));
  emit('probe-mount');
}

function goPrev(): void {
  if (useDirectUrls.value) {
    const list = props.directEntries;
    const total = list?.length ?? 0;
    if (!list || total <= 1) return;
    const idx = currentIndex.value;
    if (idx < 0) return;
    const nextIdx = idx === 0 ? total - 1 : idx - 1;
    const next = list[nextIdx];
    if (next) emit('update:directEntry', next);
    return;
  }
  const list = props.entries;
  const total = list?.length ?? 0;
  if (!list || total <= 1) return;
  const idx = currentIndex.value;
  if (idx < 0) return;
  const nextIdx = idx === 0 ? total - 1 : idx - 1;
  const next = list[nextIdx];
  if (next) emit('update:entry', next);
}

function goNext(): void {
  if (useDirectUrls.value) {
    const list = props.directEntries;
    const total = list?.length ?? 0;
    if (!list || total <= 1) return;
    const idx = currentIndex.value;
    if (idx < 0) return;
    const nextIdx = idx === total - 1 ? 0 : idx + 1;
    const next = list[nextIdx];
    if (next) emit('update:directEntry', next);
    return;
  }
  const list = props.entries;
  const total = list?.length ?? 0;
  if (!list || total <= 1) return;
  const idx = currentIndex.value;
  if (idx < 0) return;
  const nextIdx = idx === total - 1 ? 0 : idx + 1;
  const next = list[nextIdx];
  if (next) emit('update:entry', next);
}

function onPreviewKeydown(event: KeyboardEvent): void {
  if (!props.open) return;
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    goPrev();
    return;
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    goNext();
  }
}

watch(
  () =>
    [
      props.open,
      props.entry?.path,
      props.rootPath,
      props.fallbackThumbUrl,
      props.directEntry?.imageUrl,
      props.directEntry?.name,
      props.directEntries,
    ] as const,
  () => {
    void loadFullImage();
  },
  { immediate: true },
);

watch(
  () => props.mountHint,
  (hint, prev) => {
    if (prev && !hint && props.open) {
      void loadFullImage();
    }
  },
);

watch(
  () => props.open,
  (open) => {
    if (open) {
      window.addEventListener('keydown', onPreviewKeydown);
      if (faceRecognitionEnabled.value) void refreshCo21Server();
    } else {
      window.removeEventListener('keydown', onPreviewKeydown);
    }
  },
  { immediate: true },
);

watch(
  [imageAnnotationKey, taskIdRef, () => aiHealthy.value, faceRecognitionAnnotations],
  async ([key, taskId, healthy]) => {
    if (!key || !taskId || !healthy) return;
    const current = await ensureSession('face');
    if (current) void loadPendingFromSession(current, key, faceRecognitionAnnotations.value);
  },
);

onUnmounted(() => {
  window.removeEventListener('keydown', onPreviewKeydown);
});

function close(): void {
  emit('update:open', false);
}

function onDialogToggle(value: boolean): void {
  emit('update:open', value);
}

function onTagged(): void {
  emit('moved');
}

function onTagError(message: string): void {
  emit('error', message);
}

function onFaceAnnotationAdded(rect: FaceAnnotationRect): void {
  addFaceAnnotation(rect);
  faceRecognitionSelectMode.value = false;
  if (rect.label && taskIdRef.value && aiHealthy.value && imageAnnotationKey.value) {
    void syncProbes(imageAnnotationKey.value, faceRecognitionAnnotations.value);
  }
}

function onFaceAnnotationUpdated(rect: FaceAnnotationRect): void {
  updateFaceAnnotation(rect);
  if (rect.label && taskIdRef.value && aiHealthy.value && imageAnnotationKey.value) {
    void syncProbes(imageAnnotationKey.value, faceRecognitionAnnotations.value);
  }
}

function onFaceSelectCancel(): void {
  faceRecognitionSelectMode.value = false;
}

function onStageClick(): void {
  if (faceRecognitionSelectMode.value) return;
  close();
}

async function onStartBackendServer(): Promise<void> {
  const ok = await startCo21Server();
  if (!ok) {
    appNotify('negative', aiLastError.value || $text('accounts.backend_server_start_failed'));
  }
}

async function onAutoRecognize(): Promise<void> {
  const key = imageAnnotationKey.value;
  const url = imageUrl.value;
  if (!key || !url || !taskIdRef.value) {
    appNotify('warning', $text('files.recognition_task_required'));
    return;
  }

  const server = await ensureCo21ServerRunning();
  if (!server.ok) {
    appNotify('negative', server.error || $text('accounts.backend_server_start_failed'));
    return;
  }

  const detections = await recognizeImage(key, url, faceRecognitionAnnotations.value);
  if (recognitionLastError.value) {
    appNotify('negative', recognitionLastError.value);
    return;
  }
  if (!detections.length) {
    if (recognitionLastEngine.value.includes('not on server')) {
      appNotify('warning', $text('files.recognition_samples_missing'));
    } else {
      appNotify('info', $text('files.recognition_no_results'));
    }
    return;
  }
  recognitionShowPending.value = true;
}

async function onAcceptSuggested(rectId: string): Promise<void> {
  const key = imageAnnotationKey.value;
  if (!key) return;
  const detectionId = detectionIdFromSuggestedRectId(rectId);
  const accepted = await acceptPending(key, [detectionId]);
  for (const rect of accepted) {
    addFaceAnnotation(rect);
  }
}

async function onRejectSuggested(rectId: string): Promise<void> {
  const key = imageAnnotationKey.value;
  if (!key) return;
  await rejectPending(key, [detectionIdFromSuggestedRectId(rectId)]);
}
</script>

<style scoped>
.media-gallery-preview {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: #000;
  color: #fff;
}

.media-gallery-preview__stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
  overflow: hidden;
}

.media-gallery-preview__forbidden {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  max-width: min(90vw, 520px);
  padding: 24px;
  text-align: center;
  cursor: default;
}

.media-gallery-preview__forbidden-text {
  margin-top: 12px;
  color: rgba(255, 255, 255, 0.92);
  font-size: 15px;
  line-height: 1.4;
}

.media-gallery-preview__forbidden--overlay {
  position: absolute;
  inset: 0;
  z-index: 3;
  background: rgba(0, 0, 0, 0.72);
}

.media-gallery-preview__image {
  display: block;
  width: 100%;
  height: 100%;
  max-width: 100vw;
  max-height: 100vh;
  object-fit: contain;
  cursor: default;
  user-select: none;
}

.media-gallery-preview__image--loading {
  opacity: 0.55;
}

.media-gallery-preview__loading {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
}

.media-gallery-preview__nav {
  position: absolute;
  top: 50%;
  z-index: 4;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 80px;
  min-height: 140px;
  margin: 0;
  padding: 8px 4px;
  border: 0;
  border-radius: 0;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  cursor: pointer;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-50%);
  transition: opacity 140ms ease, visibility 140ms ease, background 120ms ease;
}

.media-gallery-preview__nav-loop {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.1;
  text-align: center;
  opacity: 0.92;
  max-width: 72px;
}

.media-gallery-preview__nav--prev {
  left: 0;
}

.media-gallery-preview__nav--next {
  right: 0;
}

.media-gallery-preview:hover .media-gallery-preview__nav,
.media-gallery-preview:focus-within .media-gallery-preview__nav {
  opacity: 1;
  visibility: visible;
}

.media-gallery-preview__nav:hover {
  background: rgba(0, 0, 0, 0.62);
}

.media-gallery-preview__header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 10px 28px 16px;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.72), rgba(0, 0, 0, 0));
  pointer-events: none;
}

.media-gallery-preview__header :deep(.q-btn) {
  pointer-events: auto;
}

.media-gallery-preview__header-start {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
  pointer-events: auto;
}

.media-gallery-preview__face-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  min-width: 0;
  padding: 4px;
  border-radius: 12px;
}

.media-gallery-preview__face-tools--active {
  padding: 6px 10px 6px 6px;
  background: rgba(0, 0, 0, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.32);
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.55);
}

.media-gallery-preview__face-toggle {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  min-width: 52px;
  min-height: 52px;
  padding: 0;
  background: rgba(0, 0, 0, 0.5);
  border: 2px solid rgba(255, 255, 255, 0.38);
}

.media-gallery-preview__face-toggle--on {
  background: rgba(255, 193, 7, 0.28);
  border-color: rgba(255, 193, 7, 0.95);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
}

.media-gallery-preview__title {
  font-weight: 600;
  min-width: 0;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

.media-gallery-preview__position {
  flex-shrink: 0;
  font-weight: 500;
  font-size: 0.875rem;
  opacity: 0.78;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

.media-gallery-preview__tags {
  position: absolute;
  top: 12px;
  right: 52px;
  z-index: 4;
}
</style>

<style>
.media-gallery-preview-dialog .q-dialog__inner {
  padding: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  max-width: 100vw !important;
  max-height: 100vh !important;
}

.media-gallery-preview-dialog .q-dialog__inner > div {
  width: 100%;
  height: 100%;
}
</style>
