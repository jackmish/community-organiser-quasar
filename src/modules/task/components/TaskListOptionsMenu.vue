<template>
  <q-btn
    flat
    round
    icon="more_vert"
    size="md"
    :style="`color: ${textColor || 'inherit'}; background: rgba(0,0,0,0.22) !important;`"
    @click.stop.prevent
  >
    <q-menu auto-close>
      <q-list style="min-width: 160px">
        <template v-if="showMobileStatus">
          <q-item>
            <q-item-section>
              <div class="task-menu-device-strip">
                <div
                  v-for="d in props.deviceStatuses"
                  :key="d.id"
                  class="task-menu-device-pill"
                  :class="d.connected ? 'task-menu-device-pill--on' : 'task-menu-device-pill--off'"
                >
                  <q-icon :name="d.linkIcon" size="16px" class="task-menu-device-pill__link" />
                  <div class="task-menu-device-pill__labels">
                    <span class="task-menu-device-pill__line">{{ d.shortLine1 }}</span>
                    <span v-if="d.shortLine2" class="task-menu-device-pill__line">{{
                      d.shortLine2
                    }}</span>
                  </div>
                  <q-tooltip anchor="bottom middle" self="top middle">{{ d.name }}</q-tooltip>
                </div>
              </div>
            </q-item-section>
          </q-item>
          <q-separator />
        </template>
        <q-item clickable @click="onSyncNow">
          <q-item-section avatar>
            <q-icon name="sync" />
          </q-item-section>
          <q-item-section>{{ $text('accounts.sync_now') }}</q-item-section>
        </q-item>
        <q-item clickable @click="onFullSyncNow">
          <q-item-section avatar>
            <q-icon name="sync_alt" />
          </q-item-section>
          <q-item-section>{{ $text('sync.full_sync_now') }}</q-item-section>
        </q-item>
        <q-item clickable @click="onJoinDevice">
          <q-item-section avatar>
            <q-icon name="person_add" />
          </q-item-section>
          <q-item-section>{{ $text('ui.join_device') }}</q-item-section>
        </q-item>
        <q-separator />
        <q-item clickable @click="onAddSubgroup">
          <q-item-section avatar>
            <q-icon name="subdirectory_arrow_right" />
          </q-item-section>
          <q-item-section>{{ $text('group.add_subgroup') }}</q-item-section>
        </q-item>
        <q-item clickable @click="onAddRootGroup">
          <q-item-section avatar>
            <q-icon name="create_new_folder" />
          </q-item-section>
          <q-item-section>{{ $text('group.add_root_group') }}</q-item-section>
        </q-item>
        <q-item clickable @click="onMergeGroup">
          <q-item-section avatar>
            <q-icon name="merge_type" />
          </q-item-section>
          <q-item-section>{{ $text('group.merge_group') }}</q-item-section>
        </q-item>
        <q-separator />
        <q-item clickable @click="onEditGroup">
          <q-item-section avatar>
            <q-icon name="edit" />
          </q-item-section>
          <q-item-section>{{ $text('ui.edit_group') }}</q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </q-btn>
</template>

<script setup lang="ts">
import { $text } from 'src/modules/lang';
import CC from 'src/CCAccess';
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import type { DeviceStatusRow } from 'src/utils/deviceStatusDisplay';

const props = defineProps<{
  textColor?: string;
  deviceStatuses?: DeviceStatusRow[];
}>();

const $q = useQuasar();
const showMobileStatus = computed(() => $q.screen.lt.md && (props.deviceStatuses?.length || 0) > 0);

function onEditGroup() {
  const active = CC.group.active.activeGroup.value;
  let groupId: string | null = null;
  if (active) {
    if (typeof active === 'string' || typeof active === 'number') {
      groupId = String(active);
    } else {
      const a = active as Record<string, unknown>;
      const raw = a.value ?? a.id ?? '';
      const prim = typeof raw === 'string' || typeof raw === 'number' ? raw : '';
      groupId = prim ? String(prim) : null;
    }
  }
  window.dispatchEvent(
    new CustomEvent('group:manage-edit', { detail: { groupId } })
  );
}

function onJoinDevice() {
  window.dispatchEvent(new Event('community:open'));
}

function onSyncNow() {
  window.dispatchEvent(new Event('organiser:sync-now'));
}

function onFullSyncNow() {
  window.dispatchEvent(new Event('organiser:sync-full'));
}

function onAddSubgroup() {
  const active = CC.group.active.activeGroup.value;
  const parentId =
    typeof active === 'string' || typeof active === 'number'
      ? String(active)
      : String(((active as any)?.value ?? (active as any)?.id ?? '') || '');
  window.dispatchEvent(
    new CustomEvent('group:manage-edit', {
      detail: { groupId: null, parentId: parentId || null },
    })
  );
}

function onAddRootGroup() {
  window.dispatchEvent(
    new CustomEvent('group:manage-edit', {
      detail: { groupId: null, parentId: null },
    })
  );
}

function onMergeGroup() {
  window.dispatchEvent(new Event('group:merge-open'));
}
</script>

<style scoped>
.task-menu-device-strip {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  max-width: 100%;
  padding-bottom: 2px;
}

.task-menu-device-pill {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
  gap: 5px;
  border-radius: 0;
  padding: 3px 6px;
  min-width: 52px;
  font-size: 9px;
  line-height: 1.05;
  border: 1px solid rgba(0, 0, 0, 0.12);
  flex-shrink: 0;
  background: #fff;
}

.task-menu-device-pill__labels {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 1px;
}

.task-menu-device-pill__line {
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.task-menu-device-pill__link {
  flex-shrink: 0;
}

.task-menu-device-pill--on {
  background: #dcfce7;
  border-color: #16a34a;
  color: #14532d;
}

.task-menu-device-pill--on :deep(.q-icon) {
  color: #14532d !important;
}

.task-menu-device-pill--off {
  background: #fff;
  border-color: #991b1b;
  color: #7f1d1d;
}

.task-menu-device-pill--off :deep(.q-icon) {
  color: #7f1d1d !important;
}
</style>
