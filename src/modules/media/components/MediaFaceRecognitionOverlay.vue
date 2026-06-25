<template>
  <div
    v-if="enabled && metrics"
    ref="overlayEl"
    class="media-face-overlay"
    :class="{
      'media-face-overlay--select': selectMode,
      'media-face-overlay--idle': !selectMode,
    }"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerCancel"
  >
    <div
      v-for="rect in annotations"
      :key="rect.id"
      class="media-face-overlay__box"
      :class="{
        'media-face-overlay__box--highlight': isHighlighted(rect),
        'media-face-overlay__box--dim': highlightedLabel && !isHighlighted(rect),
      }"
      :style="boxStyle(rect)"
      @click.stop
    >
      <span v-if="rect.label" class="media-face-overlay__label">{{ rect.label }}</span>
    </div>

    <div
      v-if="draftRect"
      class="media-face-overlay__box media-face-overlay__box--draft"
      :style="screenStyle(draftRect)"
    />

    <div
      v-if="pendingRect"
      class="media-face-overlay__name-layer"
      :style="screenStyle(pendingRect)"
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
        <div v-if="nameFocused && nameHints.length" class="media-face-overlay__hints">
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
        <div v-if="nameFocused" class="media-face-overlay__name-actions">
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
  normalizedRectToScreen,
  pointInImageMetrics,
  screenRectToNormalized,
  type ImageDisplayMetrics,
  type ScreenRect,
} from '../faceAnnotationGeometry';
import { createFaceAnnotationId, type FaceAnnotationRect } from '../mediaFaceAnnotationModel';
import { filterPersonNameHints } from '../mediaFaceAnnotationStorage';

const props = defineProps<{
  enabled: boolean;
  selectMode: boolean;
  annotations: FaceAnnotationRect[];
  knownNames: string[];
  highlightedLabel: string;
  stageEl: HTMLElement | null;
  imageEl: HTMLImageElement | null;
}>();

const emit = defineEmits<{
  add: [rect: FaceAnnotationRect];
  cancelSelect: [];
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

let resizeObserver: ResizeObserver | null = null;

const nameHints = computed(() => filterPersonNameHints(pendingName.value, props.knownNames));

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

function isHighlighted(rect: FaceAnnotationRect): boolean {
  if (!props.highlightedLabel) return false;
  return rect.label.localeCompare(props.highlightedLabel, undefined, { sensitivity: 'base' }) === 0;
}

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

function localPoint(event: PointerEvent): { x: number; y: number } | null {
  const stage = props.stageEl;
  const m = metrics.value;
  if (!stage || !m) return null;
  return pointInImageMetrics(event.clientX, event.clientY, stage.getBoundingClientRect(), m);
}

function onPointerDown(event: PointerEvent): void {
  if (!props.selectMode || pendingRect.value) return;
  const point = localPoint(event);
  if (!point) return;
  event.preventDefault();
  event.stopPropagation();
  activePointerId.value = event.pointerId;
  dragStart.value = point;
  draftRect.value = { x: point.x, y: point.y, width: 0, height: 0 };
  overlayEl.value?.setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent): void {
  if (activePointerId.value !== event.pointerId || !dragStart.value) return;
  const point = localPoint(event);
  if (!point) return;
  const start = dragStart.value;
  draftRect.value = {
    x: Math.min(start.x, point.x),
    y: Math.min(start.y, point.y),
    width: Math.abs(point.x - start.x),
    height: Math.abs(point.y - start.y),
  };
}

function onPointerUp(event: PointerEvent): void {
  if (activePointerId.value !== event.pointerId) return;
  overlayEl.value?.releasePointerCapture(event.pointerId);
  activePointerId.value = null;
  dragStart.value = null;

  const draft = draftRect.value;
  draftRect.value = null;
  if (!draft || draft.width < 12 || draft.height < 12) return;

  pendingRect.value = draft;
  pendingName.value = '';
  nameFocused.value = false;
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

.media-face-overlay--select {
  pointer-events: auto;
  cursor: crosshair;
}

.media-face-overlay__box {
  position: absolute;
  box-sizing: border-box;
  border: 2px solid rgba(120, 220, 255, 0.95);
  background: rgba(80, 180, 255, 0.12);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
  transition: opacity 120ms ease, border-color 120ms ease, background 120ms ease;
}

.media-face-overlay__box--draft {
  border-style: dashed;
  background: rgba(255, 255, 255, 0.08);
}

.media-face-overlay__box--highlight {
  border-color: rgba(255, 214, 102, 0.98);
  background: rgba(255, 214, 102, 0.2);
}

.media-face-overlay__box--dim {
  opacity: 0.35;
}

.media-face-overlay__label {
  position: absolute;
  left: 0;
  bottom: 100%;
  margin-bottom: 4px;
  max-width: 220px;
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
  pointer-events: none;
}

.media-face-overlay__name-layer {
  position: absolute;
  pointer-events: auto;
}

.media-face-overlay__name-card {
  position: absolute;
  left: 0;
  top: 0;
  min-width: min(240px, 100%);
  max-width: 280px;
  padding: 8px;
  border-radius: 8px;
  background: rgba(12, 18, 28, 0.72);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.18);
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
