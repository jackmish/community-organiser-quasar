<template>
  <div style="display: flex; align-items: center; gap: 8px">
    <q-select
      v-model="localActive"
      :options="options"
      outlined
      dense
      style="min-width: 220px"
      label="Active Group"
      @update:model-value="onChange"
    >
      <template #prepend>
        <q-icon name="folder_open" />
      </template>
    </q-select>
    <q-btn dense flat round icon="more_vert" @click="openManage" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useDayOrganiser } from 'src/modules/day-organiser';

const { groups, activeGroup } = useDayOrganiser();

const localActive = ref(activeGroup.value);

watch(activeGroup, (v) => {
  localActive.value = v;
});

const options = computed(() => {
  const base = [{ label: 'All Groups', value: null } as any];
  const g = (groups.value || []).map((gg: any) => ({ label: gg.name, value: gg.id }));
  return base.concat(g);
});

const onChange = (val: any) => {
  activeGroup.value = val;
};

const openManage = () => {
  try {
    window.dispatchEvent(new Event('group:manage'));
  } catch (e) {
    // ignore
  }
};
</script>
