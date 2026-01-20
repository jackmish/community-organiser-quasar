<template>
  <div style="display: flex; align-items: center; gap: 8px">
    <template v-if="optionsReady">
      <q-select
        :key="selectKey"
        v-model="localValue"
        :options="options"
        option-value="value"
        option-label="label"
        emit-value
        map-options
        outlined
        dense
        class="group-select--header"
        color="white"
        text-color="white"
        style="min-width: 220px"
        label="Active Group"
        @update:model-value="onChange"
      >
        <template #prepend>
          <q-icon
            :name="selectedOption?.icon || 'folder_open'"
            :style="{ color: selectedOption?.color || 'inherit' }"
          />
        </template>

        <template #option="scope">
          <q-item clickable v-ripple @click.stop.prevent="scope.toggleOption(scope.opt)">
            <q-item-section avatar style="min-width: 36px">
              <q-icon
                :name="scope.opt?.icon || 'folder'"
                :style="{ color: scope.opt?.color || 'inherit' }"
              />
            </q-item-section>
            <q-item-section>
              <div>{{ scope.opt?.label }}</div>
            </q-item-section>
          </q-item>
        </template>
      </q-select>
    </template>
    <template v-else>
      <div style="min-width: 220px; height: 38px; display: flex; align-items: center">
        <q-skeleton type="rect" style="width: 100%; height: 100%" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useDayOrganiser } from 'src/modules/day-organiser';

const { groups, activeGroup, isLoading } = useDayOrganiser();

const localValue = ref<string | null>(null);
let prevValue: string | null = null;

// expose options once loading finishes
const optionsReady = ref(false);
watch(
  () => isLoading && isLoading.value,
  (loading) => {
    if (loading === false) optionsReady.value = true;
  },
  { immediate: true },
);

const options = computed(() => {
  const base = [{ label: 'All Groups', value: null } as any];
  const groupOptions = (groups.value || []).map((gg: any) => ({
    label: gg.name,
    value: String(gg.id),
    icon: gg.icon || 'folder',
    color: gg.color || null,
  }));
  const manage = { label: 'Manage Groups...', value: '__manage_groups__' } as any;

  // include activeGroup if it's not present so q-select can display its label
  const combined = base.concat(groupOptions);
  const cur = activeGroup.value;
  if (cur) {
    const curVal =
      typeof cur === 'string' || typeof cur === 'number'
        ? String(cur)
        : String((cur as any).value ?? (cur as any).id ?? '');
    if (curVal && !combined.some((o: any) => o.value === curVal)) {
      const found = (groups.value || []).find((g: any) => String(g.id) === curVal);
      const label = (cur as any).label || (found && found.name) || curVal;
      combined.push({
        label,
        value: curVal,
        icon: found?.icon || 'folder',
        color: found?.color || null,
      });
    }
  }
  return combined.concat(manage);
});

const selectedOption = computed(() => {
  try {
    if (!options.value) return null;
    if (!localValue.value) return options.value[0] || null;
    return (
      options.value.find((o: any) => String(o.value) === String(localValue.value)) ||
      options.value[0]
    );
  } catch (e) {
    return null;
  }
});

const selectKey = computed(
  () =>
    `gsel-${optionsReady.value ? 'r' : 'w'}-${(options.value || []).length}-${localValue.value ?? 'nil'}`,
);

// keep localValue in sync with shared activeGroup
watch(
  activeGroup,
  (v) => {
    if (!v) {
      localValue.value = null;
      prevValue = null;
      return;
    }
    const val =
      typeof v === 'string' || typeof v === 'number'
        ? String(v)
        : String((v as any).value ?? (v as any).id ?? '');
    localValue.value = val || null;
    prevValue = val || null;
  },
  { immediate: true },
);

// ensure activeGroup is set to a sensible default when groups load
watch(
  groups,
  (list) => {
    if (!list || list.length === 0) return;
    if (!activeGroup.value) {
      const fg = list[0];
      if (!fg) return;
      activeGroup.value = { label: fg.name || String(fg.id), value: String(fg.id) };
      localValue.value = String(fg.id);
      prevValue = String(fg.id);
      return;
    }
    // sync label/value with group record if possible
    const ag = activeGroup.value as any;
    const gid =
      typeof ag === 'string' || typeof ag === 'number'
        ? String(ag)
        : String(ag.value ?? ag.id ?? '');
    if (!gid) return;
    const found = (list || []).find((g: any) => String(g.id) === gid);
    if (found) {
      if (ag.label !== found.name || ag.value !== gid)
        activeGroup.value = { label: found.name, value: gid };
      if (localValue.value !== gid) localValue.value = gid;
    }
  },
  { immediate: true },
);

const onChange = (val: any) => {
  if (val === '__manage_groups__') {
    window.dispatchEvent(new Event('group:manage-request'));
    localValue.value = prevValue;
    return;
  }
  const opt = options.value.find((o: any) => o.value === val);
  if (opt) activeGroup.value = { label: opt.label, value: opt.value };
  else activeGroup.value = null;
  prevValue = val ?? null;
};
</script>

<style scoped></style>
