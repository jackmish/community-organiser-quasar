<template>
  <div
    v-if="resolveLabel()"
    ref="rootEl"
    :class="['co21-watermark', `co21-watermark--${resolveSize()}`]"
    :title="resolveLabel()"
    :style="{ justifyContent: resolveJustify() }"
  >
    <div
      v-if="resolveBackgroundStyle()"
      ref="bgEl"
      class="co21-watermark-bg"
      :style="bgFinalStyle || resolveBackgroundStyle()"
    ></div>
    <div ref="textEl" class="co21-watermark-text" :style="{ color: resolveTextColor() }">
      {{ resolveLabel() }}
    </div>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: "Co21Watermark" });
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from "vue";
import type { Ref } from "vue";

const props = defineProps<{
  activeGroup?: unknown;
  label?: string | Ref<string>;
  color?: string | Ref<string>;
  justifyContent?: string | Ref<string>;
  background?: string | Ref<string>;
  size?: string | Ref<string>;
}>();

const rootEl = ref<HTMLElement | null>(null);
const textEl = ref<HTMLElement | null>(null);
const bgEl = ref<HTMLElement | null>(null);
const bgFinalStyle = ref<Record<string, string> | null>(null);

let ro: ResizeObserver | null = null;

function resolveLabel() {
  const explicit = (props as any).label;
  const explicitVal =
    explicit && typeof explicit === "object" && "value" in explicit
      ? explicit.value
      : explicit;
  if (explicitVal) return explicitVal || "";

  const ag = (props as any).activeGroup;
  const val = ag && typeof ag === "object" && "value" in ag ? ag.value : ag;
  if (!val) return "";
  return val.label ?? val.value ?? val.id ?? "";
}

function resolveTextColor() {
  const c = (props as any).color;
  const val = c && typeof c === "object" && "value" in c ? c.value : c;
  return val || "rgba(0, 255, 255, 0.1)";
}

function resolveJustify() {
  const j = (props as any).justifyContent;
  const val = j && typeof j === "object" && "value" in j ? j.value : j;
  return val || "flex-end";
}

function resolveSize() {
  const s = (props as any).size;
  const val = s && typeof s === "object" && "value" in s ? s.value : s;
  const v = (val || "large").toString().toLowerCase();
  if (v === "small" || v === "medium" || v === "large") return v;
  return "large";
}

function resolveBackgroundStyle() {
  const b = (props as any).background;
  const val = b && typeof b === "object" && "value" in b ? b.value : b;
  if (!val) return null;

  // Support syntax: "blur(4px) rgba(0,0,0,0.2)" -> backdrop-filter blur + semi-transparent color
  const blurMatch = String(val).match(/^\s*blur\(([^)]+)\)\s*(.*)$/i);
  if (blurMatch) {
    const blurAmt = blurMatch[1];
    const colorPart = blurMatch[2] || "rgba(255,255,255,0.2)";
    return {
      background: colorPart,
      backdropFilter: `blur(${blurAmt})`,
      WebkitBackdropFilter: `blur(${blurAmt})`,
      pointerEvents: "none",
      borderRadius: "6px",
    } as any;
  }

  // If value looks like a complex CSS (gradient, rgba, url), use as background
  if (/(gradient|rgba|hsla|url\(|linear-gradient|radial-gradient)/i.test(String(val))) {
    return {
      background: String(val),
      pointerEvents: "none",
      borderRadius: "6px",
    } as any;
  }

  // Otherwise treat as simple color and apply light opacity
  return {
    background: String(val),
    opacity: "0.18",
    pointerEvents: "none",
    borderRadius: "6px",
  } as any;
}

function computeBgPosition() {
  const base = resolveBackgroundStyle();
  if (!base) {
    bgFinalStyle.value = null;
    return;
  }
  if (!rootEl.value || !textEl.value) {
    bgFinalStyle.value = Object.assign({}, base);
    return;
  }

  const rootRect = rootEl.value.getBoundingClientRect();
  const txtRect = textEl.value.getBoundingClientRect();

  const left = Math.max(0, Math.round(txtRect.left - rootRect.left));
  const top = Math.max(0, Math.round(txtRect.top - rootRect.top));
  const width = Math.max(0, Math.round(txtRect.width));
  const height = Math.max(0, Math.round(txtRect.height));

  const style: Record<string, string> = Object.assign({}, base);
  style.position = "absolute";
  style.left = `${left}px`;
  style.top = `${top}px`;
  style.width = `${width}px`;
  style.height = `${height}px`;
  style.pointerEvents = "none";
  style.borderRadius = style.borderRadius || "6px";

  bgFinalStyle.value = style;
}

onMounted(() => {
  nextTick(() => computeBgPosition());
  if (rootEl.value) {
    ro = new ResizeObserver(() => computeBgPosition());
    ro.observe(rootEl.value);
    if (textEl.value) ro.observe(textEl.value);
  }
});

onBeforeUnmount(() => {
  if (ro) {
    try {
      ro.disconnect();
    } catch (e) {
      // ignore
    }
  }
});

watch(
  () => [resolveLabel(), (props as any).background, (props as any).color],
  () => nextTick().then(computeBgPosition)
);
</script>

<style scoped>
.co21-watermark {
  position: absolute;
  inset: 0; /* top:0; right:0; bottom:0; left:0 */
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  pointer-events: none; /* don't block interaction */
  z-index: 999999999999999; /* top layer but below modal overlays if needed */
  top: 0;
  /* z-index: 0; */
}

.co21-watermark-text {
  /* color: rgba(0, 0, 0, 1); */
  color: rgba(0, 255, 255, 0.1);
  font-weight: 700;
  text-transform: uppercase;
  white-space: nowrap;
  font-size: 95px; /* subtle, scales with viewport */
  line-height: 1;
  user-select: none;
  /* transform: rotate(0deg); */
  letter-spacing: 0.12em;
  text-align: center;
  mix-blend-mode: multiply; /* subtly darken background where text overlaps */
}
.co21-watermark-text {
  position: relative;
  padding: 6px 10px;
}
.co21-watermark-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: 6px;
  mix-blend-mode: normal; /* ensure background uses default blending */
}

/* Size variants */
.co21-watermark--small .co21-watermark-text {
  font-size: 16px;
}
.co21-watermark--medium .co21-watermark-text {
  font-size: 40px;
}
.co21-watermark--large .co21-watermark-text {
  font-size: 80px;
}
.co21-watermark {
  overflow: visible;
}
.co21-watermark-text {
  z-index: 1;
}
</style>
