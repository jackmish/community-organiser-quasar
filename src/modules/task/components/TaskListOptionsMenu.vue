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
        <q-item clickable @click="onEditGroup">
          <q-item-section avatar>
            <q-icon name="edit" />
          </q-item-section>
          <q-item-section>{{ $text('ui.edit_group') }}</q-item-section>
        </q-item>
        <q-item clickable @click="onJoinDevice">
          <q-item-section avatar>
            <q-icon name="person_add" />
          </q-item-section>
          <q-item-section>{{ $text('ui.join_device') }}</q-item-section>
        </q-item>
      </q-list>
    </q-menu>
  </q-btn>
</template>

<script setup lang="ts">
import { $text } from 'src/modules/lang';
import CC from 'src/CentralController';

defineProps<{
  textColor?: string;
}>();

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
</script>
