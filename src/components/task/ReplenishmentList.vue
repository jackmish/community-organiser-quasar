<template>
  <q-card
    flat
    :class="['q-pa-sm q-mb-md', size === 'small' ? 'replenish-small' : 'replenish-default']"
    :style="containerStyle"
  >
    <!-- <div class="row items-center" style="gap: 8px">
      <q-icon name="shopping_cart" color="primary" />
      <div class="text-subtitle2 text-primary"><strong>Replenishment</strong></div>
    </div> -->
    <div class="replenish-grid">
      <div
        v-for="(r, idx) in sortedReplenish"
        :key="r.id"
        class="replenish-item card q-pa-sm"
        role="button"
        @pointerdown="() => startLongPress(r)"
        @pointerup="cancelLongPress"
        @pointercancel="cancelLongPress"
        @pointerleave="cancelLongPress"
        @click="onReplenishClick(r)"
        :style="{ background: getReplenishBg(r) }"
      >
        <!-- Show a tiny group label above the first item of a group -->
        <div v-if="isNewGroup(idx, r)" class="group-label">
          {{ getGroupName(r.groupId || r.group_id) }}
        </div>
        <!-- subtle divider spanning the row to separate groups without extra spacing -->
        <div v-if="isNewGroup(idx, r)" class="group-divider" aria-hidden="true"></div>
        <div class="row items-center justify-between" style="gap: 8px">
          <div
            :class="{ 'text-strike': Number(r.status_id) === 0 }"
            :style="{ color: getReplenishText(r) }"
          >
            {{ r.name }}
          </div>
        </div>
      </div>
    </div>
  </q-card>
</template>

<script setup lang="ts">
import { useLongPress } from 'src/composables/useLongPress';
import {
  findReplenishSet,
  getReplenishBg as themeGetReplenishBg,
  getReplenishText as themeGetReplenishText,
} from '../theme';

const props = defineProps<{
  replenishTasks: any[];
  size?: 'default' | 'small';
}>();

const size = props.size || 'default';

import { computed } from 'vue';

// access group list to resolve group names for tiny labels
import * as api from 'src/modules/day-organiser/_apiRoot';
const groups = api.group.list.all;

function getGroupName(groupId: any) {
  if (!groupId) return '';
  const g = groups.value.find((x: any) => String(x.id) === String(groupId));
  return g ? g.name : '';
}

function isNewGroup(idx: number, task: any) {
  if (!Array.isArray(sortedReplenish.value)) return false;
  const cur = task;
  const prev = idx > 0 ? sortedReplenish.value[idx - 1] : null;
  const curId = cur?.groupId ?? cur?.group_id ?? null;
  const prevId = prev?.groupId ?? prev?.group_id ?? null;
  return idx === 0 || String(curId) !== String(prevId);
}

const sortedReplenish = computed(() => {
  const src = Array.isArray(props.replenishTasks) ? props.replenishTasks.slice() : [];
  // Sort by group ancestry path (root -> ... -> group) so parent group
  // replenishments appear before those of their child groups.
  const getGroupPath = (groupId: any) => {
    if (!groupId) return [] as string[];
    const out: string[] = [];
    let cur = groups.value.find((g: any) => String(g.id) === String(groupId));
    while (cur) {
      out.push(cur.name || String(cur.id));
      const pid = cur.parentId ?? cur.parent_id ?? null;
      if (pid == null) break;
      cur = groups.value.find((g: any) => String(g.id) === String(pid));
    }
    return out.reverse();
  };

  src.sort((a: any, b: any) => {
    const pa = getGroupPath(a.groupId ?? a.group_id);
    const pb = getGroupPath(b.groupId ?? b.group_id);
    const max = Math.max(pa.length, pb.length);
    for (let i = 0; i < max; i++) {
      if (i >= pa.length) return -1; // a is ancestor (shorter path) -> comes first
      if (i >= pb.length) return 1; // b is ancestor
      const na = (pa[i] || '').toLowerCase();
      const nb = (pb[i] || '').toLowerCase();
      if (na < nb) return -1;
      if (na > nb) return 1;
    }
    // same group path: fallback to task name
    const na = (a.name || '').toLowerCase();
    const nb = (b.name || '').toLowerCase();
    if (na < nb) return -1;
    if (na > nb) return 1;
    return 0;
  });
  return src;
});

// Compute a container style so the whole ReplenishmentList card can span
// multiple columns in the parent grid. For small mode: 1-3 items -> span 1,
// 4-6 -> span 2, 7-9 -> span 3, etc.
const containerStyle = computed(() => {
  const base: any = { background: 'transparent', borderRadius: '8px' };
  if (size !== 'small') return base;
  const n = Array.isArray(props.replenishTasks) ? props.replenishTasks.length : 0;
  const span = Math.max(1, Math.ceil(n / 3));
  // Set gridColumn to span N so the card consumes multiple columns in the parent's grid
  base.gridColumn = `span ${span}`;
  return base;
});

const emit = defineEmits<{
  (e: 'toggle-status', task: any): void;
  (e: 'edit-task', task: any): void;
  (e: 'replenish-restore', taskId: string): void;
}>();

// Use centralized replenish color helpers from theme
const getReplenishBg = (task: any) => themeGetReplenishBg(task.color_set);
const getReplenishText = (task: any) => themeGetReplenishText(task.color_set);

// Use local long-press to emit edit requests
const { startLongPress, cancelLongPress, setLongPressHandler, longPressTriggered } = useLongPress();
setLongPressHandler((t: any) => emit('edit-task', t));

function onReplenishClick(task: any) {
  // If a long-press handler was triggered, don't toggle status on the subsequent click.
  try {
    if (longPressTriggered && longPressTriggered.value) {
      // reset flag and ignore this click which follows a long-press
      longPressTriggered.value = false;
      return;
    }
  } catch (e) {
    // ignore and proceed
  }
  emit('toggle-status', task);
}

function onDoneClick(task: any) {
  emit('toggle-status', task);
}
</script>

<style scoped>
.replenish-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.replenish-item {
  cursor: pointer;
  border-radius: 6px;
  background: #fff9;
  padding: 8px;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* make each item a positioning context for the absolute label/divider */
.replenish-item {
  position: relative;
}

.group-label {
  position: absolute;
  top: -10px;
  left: 8px;
  font-size: 11px;
  line-height: 1;
  color: rgba(0, 0, 0, 0.6);
  background: rgba(255, 255, 255, 0.85);
  padding: 0 6px;
  border-radius: 8px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.02) inset;
  pointer-events: none;
}

.group-divider {
  position: absolute;
  top: -6px;
  left: -8px;
  right: -8px;
  height: 1px;
  background: rgba(0, 0, 0, 0.06);
  pointer-events: none;
}
.done-item {
  filter: grayscale(100%);
  opacity: 0.9;
  background: transparent;
  border-radius: 6px;
  padding: 6px 8px;
  margin-bottom: 6px;
}

/* Small mode (compact) */
.replenish-small .replenish-grid {
  grid-template-columns: repeat(auto-fit, minmax(72px, 1fr));
  gap: 6px;
}
.replenish-small .replenish-item {
  padding: 4px;
  min-height: 22px;
  font-size: 11px;
  border-radius: 4px;
}
.replenish-small .replenish-item .text-body1 {
  font-size: 11px;
  line-height: 1;
}
.replenish-small q-icon {
  font-size: 14px;
}

/* Default mode keeps original spacing but provide a named class for clarity */
.replenish-default .replenish-grid {
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
</style>
