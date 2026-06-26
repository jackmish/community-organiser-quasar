<template>
  <div
    v-if="enabled && metrics"
    ref="overlayEl"
    class="media-face-overlay"
    :class="{
      'media-face-overlay--select': selectMode,
      'media-face-overlay--idle': !selectMode,
      'media-face-overlay--naming': !!pendingRect,
    }"
    @click.stop="onOverlayClick"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    <div
      v-for="rect in annotations"
      :key="rect.id"
      class="media-face-overlay__box"
      :class="{ 'media-face-overlay__box--hover': hoveredId === rect.id }"
      :style="boxStyle(rect)"
      @mouseenter="hoveredId = rect.id"
      @mouseleave="hoveredId = ''"
      @click.stop
    >
      <div
        v-if="rect.label || hoveredId === rect.id"
        class="media-face-overlay__label-row"
      >
        <span class="media-face-overlay__label">
          {{ rect.label || $text('files.face_unnamed') }}
        </span>
        <button
          v-if="hoveredId === rect.id"
          type="button"
          class="media-face-overlay__remove"
          :aria-label="$text('action.delete')"
          :title="$text('action.delete')"
          @click.stop="emit('remove', rect.id)"
        >
          <q-icon name="close" size="16px" />
        </button>
      </div>
    </div>

    <div
      v-for="rect in suggestedAnnotations"
      v-show="showSuggested"
      :key="`suggested-${rect.id}`"
      class="media-face-overlay__box media-face-overlay__box--suggested"
      :class="{ 'media-face-overlay__box--hover': hoveredSuggestedId === rect.id }"
      :style="boxStyle(rect)"
      @mouseenter="hoveredSuggestedId = rect.id"
      @mouseleave="hoveredSuggestedId = ''"
      @click.stop
    >
      <div
        v-if="rect.label || hoveredSuggestedId === rect.id"
        class="media-face-overlay__label-row"
      >
        <span class="media-face-overlay__label">
          {{ rect.label || $text('files.face_unnamed') }}
        </span>
        <div v-if="hoveredSuggestedId === rect.id" class="media-face-overlay__suggested-actions">
          <button
            type="button"
            class="media-face-overlay__remove"
            :aria-label="$text('action.cancel')"
            :title="$text('files.recognition_reject')"
            @click.stop="emit('reject-suggested', rect.id)"
          >
            <q-icon name="close" size="16px" />
          </button>
          <button
            type="button"
            class="media-face-overlay__accept"
            :aria-label="$text('action.confirm')"
            :title="$text('files.recognition_accept')"
            @click.stop="emit('accept-suggested', rect.id)"
          >
            <q-icon name="check" size="16px" />
          </button>
        </div>
      </div>
    </div>

    <div
      v-if="draftRect"
      class="media-face-overlay__box media-face-overlay__box--draft"
      :style="screenStyle(draftRect)"
    />

    <div
      v-if="pendingRect"
      class="media-face-overlay__box media-face-overlay__box--pending"
      :style="screenStyle(pendingRect)"
    />

    <div
      v-if="pendingRect"
      class="media-face-overlay__name-anchor"
      :style="nameCardStyle"
      @click.stop
      @pointerdown.stop
    >
      <div class="media-face-overlay__name-card">
        <q-input
          ref="nameInputRef"
          v-model="pendingName"
          dense
          dark
          borderless
          :placeholder="$text('files.face_name_placeholder')"
          class="media-face-overlay__name-input"
          @focus="nameFocused = true"
          @blur="onNameBlur"
          @keydown.enter.prevent="confirmPending"
          @keydown.escape.prevent="cancelPending"
        />
        <div v-if="nameHints.length" class="media-face-overlay__hints">
          <button
            v-for="hint in nameHints"
            :key="hint"
            type="button"
            class="media-face-overlay__hint"
            @mousedown.prevent="applyHint(hint)"
          >
            {{ hint }}
          </button>
        </div>
        <div class="media-face-overlay__name-actions">
          <q-btn
            flat
            dense
            round
            size="sm"
            icon="close"
            color="white"
            :aria-label="$text('action.cancel')"
            @mousedown.prevent
            @click="cancelPending"
          />
          <q-btn
            flat
            dense
            round
            size="sm"
            icon="check"
            color="positive"
            :aria-label="$text('action.confirm')"
            @mousedown.prevent
            @click="confirmPending"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch, type CSSProperties } from 'vue';
import { $text } from 'src/modules/lang';
import {
  computeImageDisplayMetrics,
  computeNameCardPosition,
  isPointInImageDisplay,
  normalizedRectToScreen,
  screenRectFromStageDrag,
  screenRectToNormalized,
  stagePointFromClient,
  type ImageDisplayMetrics,
  type ScreenRect,
} from '../faceAnnotationGeometry';
import { createFaceAnnotationId, type FaceAnnotationRect } from '../mediaFaceAnnotationModel';
import { filterPersonNameHints } from '../mediaFaceAnnotationStorage';

const props = defineProps<{
  enabled: boolean;
  selectMode: boolean;
  annotations: FaceAnnotationRect[];
  suggestedAnnotations?: FaceAnnotationRect[];
  showSuggested?: boolean;
  knownNames: string[];
  stageEl: HTMLElement | null;
  imageEl: HTMLImageElement | null;
}>();

const emit = defineEmits<{
  add: [rect: FaceAnnotationRect];
  cancelSelect: [];
  remove: [id: string];
  'accept-suggested': [id: string];
  'reject-suggested': [id: string];
}>();

const overlayEl = ref<HTMLElement | null>(null);
const metrics = ref<ImageDisplayMetrics | null>(null);
const draftRect = ref<ScreenRect | null>(null);
const pendingRect = ref<ScreenRect | null>(null);
const pendingName = ref('');
const nameFocused = ref(false);
const nameInputRef = ref<{ focus: () => void } | null>(null);
const dragStart = ref<{ x: number; y: number } | null>(null);
const activePointerId = ref<number | null>(null);
const hoveredId = ref('');
const hoveredSuggestedId = ref('');
let suppressClickAfterDrag = false;

let resizeObserver: ResizeObserver | null = null;

const suggestedAnnotations = computed(() => props.suggestedAnnotations || []);
const showSuggested = computed(() => props.showSuggested === true);

const nameHints = computed(() => filterPersonNameHints(pendingName.value, props.knownNames));

const nameCardStyle = computed((): CSSProperties => {
  const rect = pendingRect.value;
  const m = metrics.value;
  const stage = props.stageEl;
  if (!rect || !m || !stage) return { display: 'none' };

  const stageRect = stage.getBoundingClientRect();
  const pos = computeNameCardPosition(rect, m, stageRect.width, stageRect.height);
  return {
    left: `${pos.x}px`,
    top: `${pos.y}px`,
  };
});

function refreshMetrics(): void {
  const stage = props.stageEl;
  const image = props.imageEl;
  if (!stage || !image) {
    metrics.value = null;
    return;
  }
  const rect = stage.getBoundingClientRect();
  metrics.value = computeImageDisplayMetrics(
    rect.width,
    rect.height,
    image.naturalWidth,
    image.naturalHeight,
  );
}

function bindObservers(): void {
  resizeObserver?.disconnect();
  resizeObserver = null;
  const stage = props.stageEl;
  const image = props.imageEl;
  if (!stage || !image) return;

  resizeObserver = new ResizeObserver(() => refreshMetrics());
  resizeObserver.observe(stage);
  image.addEventListener('load', refreshMetrics);
}

function unbindObservers(): void {
  resizeObserver?.disconnect();
  resizeObserver = null;
  props.imageEl?.removeEventListener('load', refreshMetrics);
}

watch(
  () => [props.stageEl, props.imageEl, props.enabled] as const,
  () => {
    unbindObservers();
    refreshMetrics();
    if (props.enabled) bindObservers();
  },
  { immediate: true },
);

onUnmounted(() => {
  unbindObservers();
});

watch(
  () => props.selectMode,
  (active) => {
    if (!active) {
      draftRect.value = null;
      dragStart.value = null;
      activePointerId.value = null;
    }
  },
);

function boxStyle(rect: FaceAnnotationRect): CSSProperties {
  const m = metrics.value;
  if (!m) return {};
  return screenStyle(normalizedRectToScreen(rect, m));
}

function screenStyle(rect: ScreenRect): CSSProperties {
  return {
    left: `${rect.x}px`,
    top: `${rect.y}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  };
}

function stagePoint(event: PointerEvent): { x: number; y: number } | null {
  const stage = props.stageEl;
  if (!stage) return null;
  return stagePointFromClient(event.clientX, event.clientY, stage.getBoundingClientRect());
}

function onPointerDown(event: PointerEvent): void {
  if (!props.selectMode || pendingRect.value) return;
  const m = metrics.value;
  const point = stagePoint(event);
  if (!m || !point || !isPointInImageDisplay(point.x, point.y, m)) return;
  event.preventDefault();
  event.stopPropagation();
  activePointerId.value = event.pointerId;
  dragStart.value = point;
  draftRect.value = { x: point.x, y: point.y, width: 0, height: 0 };
  overlayEl.value?.setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent): void {
  if (activePointerId.value !== event.pointerId || !dragStart.value) return;
  const m = metrics.value;
  const point = stagePoint(event);
  if (!m || !point) return;
  draftRect.value = screenRectFromStageDrag(dragStart.value, point, m);
}

function onOverlayClick(event: MouseEvent): void {
  event.stopPropagation();
  if (suppressClickAfterDrag) {
    suppressClickAfterDrag = false;
  }
}

function onPointerUp(event: PointerEvent): void {
  if (activePointerId.value !== event.pointerId) return;
  event.preventDefault();
  event.stopPropagation();
  overlayEl.value?.releasePointerCapture(event.pointerId);
  activePointerId.value = null;
  dragStart.value = null;

  const draft = draftRect.value;
  draftRect.value = null;
  if (!draft || draft.width < 12 || draft.height < 12) return;

  suppressClickAfterDrag = true;
  pendingRect.value = draft;
  pendingName.value = '';
  nameFocused.value = true;
  void nextTick(() => nameInputRef.value?.focus());
}

function onPointerCancel(event: PointerEvent): void {
  if (activePointerId.value !== event.pointerId) return;
  overlayEl.value?.releasePointerCapture(event.pointerId);
  activePointerId.value = null;
  dragStart.value = null;
  draftRect.value = null;
}

function applyHint(hint: string): void {
  pendingName.value = hint;
  void nextTick(() => nameInputRef.value?.focus());
}

function onNameBlur(): void {
  window.setTimeout(() => {
    nameFocused.value = false;
  }, 120);
}

function confirmPending(): void {
  const screen = pendingRect.value;
  const m = metrics.value;
  if (!screen || !m) return;
  const normalized = screenRectToNormalized(screen, m);
  if (normalized.width <= 0 || normalized.height <= 0) {
    cancelPending();
    return;
  }
  const label = pendingName.value.trim();
  emit('add', {
    id: createFaceAnnotationId(),
    ...normalized,
    label,
  });
  pendingRect.value = null;
  pendingName.value = '';
  nameFocused.value = false;
  emit('cancelSelect');
}

function cancelPending(): void {
  pendingRect.value = null;
  pendingName.value = '';
  nameFocused.value = false;
}
</script>

<style scoped>
.media-face-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}

.media-face-overlay--select,
.media-face-overlay--naming {
  pointer-events: auto;
  cursor: crosshair;
}

.media-face-overlay--naming {
  cursor: default;
}

.media-face-overlay--idle .media-face-overlay__box {
  pointer-events: auto;
  cursor: default;
}

.media-face-overlay__box {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid rgba(120, 220, 255, 0.95);
  background: transparent;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
  transition: opacity 120ms ease, border-color 120ms ease;
}

.media-face-overlay__box--hover {
  border-color: rgba(255, 214, 102, 0.98);
}

.media-face-overlay__box--draft {
  border-style: dashed;
  background: transparent;
}

.media-face-overlay__box--pending {
  border-color: rgba(255, 193, 7, 0.98);
  border-width: 3px;
  background: transparent;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.45);
  pointer-events: none;
}

.media-face-overlay__box--suggested {
  border-color: rgba(186, 104, 255, 0.98);
  border-style: dashed;
  background: rgba(186, 104, 255, 0.08);
}

.media-face-overlay__suggested-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.media-face-overlay__accept {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: rgba(76, 175, 80, 0.9);
  color: #fff;
  cursor: pointer;
}

.media-face-overlay__label-row {
  position: absolute;
  left: 0;
  bottom: 100%;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 260px;
  margin-bottom: 4px;
  pointer-events: auto;
}

.media-face-overlay__label {
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.media-face-overlay__remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: rgba(198, 40, 40, 0.92);
  color: #fff;
  cursor: pointer;
}

.media-face-overlay__remove:hover {
  background: rgba(229, 57, 53, 1);
}

.media-face-overlay__name-anchor {
  position: absolute;
  z-index: 4;
  width: 280px;
  pointer-events: auto;
}

.media-face-overlay__name-card {
  position: relative;
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(12, 18, 28, 0.88);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.28);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
}

.media-face-overlay__name-input {
  font-size: 0.9rem;
}

.media-face-overlay__name-input :deep(.q-field__control) {
  min-height: 32px;
}

.media-face-overlay__hints {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.media-face-overlay__hint {
  margin: 0;
  padding: 2px 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 0.72rem;
  cursor: pointer;
}

.media-face-overlay__hint:hover {
  background: rgba(255, 255, 255, 0.16);
}

.media-face-overlay__name-actions {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  margin-top: 4px;
}
</style>
