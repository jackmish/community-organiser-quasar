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
          <q-icon name="folder_open" />
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
      combined.push({ label, value: curVal });
    }
  }
  return combined.concat(manage);
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
    window.dispatchEvent(new Event('group:manage'));
    localValue.value = prevValue;
    return;
  }
  const opt = options.value.find((o: any) => o.value === val);
  if (opt) activeGroup.value = { label: opt.label, value: opt.value };
  else activeGroup.value = null;
  prevValue = val ?? null;
};
</script>

<style scoped>
.group-select--header ::v-deep .q-field__control {
  border-color: rgba(255, 255, 255, 0.95) !important;
  box-shadow: none !important;
  background: transparent !important;
}

/* specifically target outlined variant and focus states */
.group-select--header ::v-deep .q-field--outlined .q-field__control,
.group-select--header ::v-deep .q-field--outlined .q-field__control::before,
.group-select--header ::v-deep .q-field--outlined .q-field__control::after,
.group-select--header ::v-deep .q-field--outlined.q-focused .q-field__control {
  border-color: rgba(255, 255, 255, 0.95) !important;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.08) !important;
}

.group-select--header ::v-deep .q-field__label,
.group-select--header ::v-deep .q-select__input,
.group-select--header ::v-deep .q-item__label,
.group-select--header ::v-deep .q-field__native {
  color: #ffffff !important;
}

.group-select--header ::v-deep .q-icon,
.group-select--header ::v-deep .q-field__label,
.group-select--header ::v-deep .q-field__label--float {
  color: #ffffff !important;
}

/* ensure dropdown items in the menu are readable on dark header */
.group-select--header ::v-deep .q-menu .q-item__label {
  color: #000 !important;
}

/* Extra overrides for stubborn outlined borders and pseudo-elements */
.group-select--header ::v-deep .q-field__control,
.group-select--header ::v-deep .q-select__control,
.group-select--header ::v-deep .q-field--outlined .q-field__control,
.group-select--header ::v-deep .q-select--outlined .q-field__control {
  border: 1px solid rgba(255, 255, 255, 0.95) !important;
  border-color: rgba(255, 255, 255, 0.95) !important;
  box-shadow: none !important;
  background: transparent !important;
}

.group-select--header ::v-deep .q-field__control::before,
.group-select--header ::v-deep .q-field__control::after {
  border-color: rgba(255, 255, 255, 0.95) !important;
  background: transparent !important;
}

.group-select--header ::v-deep .q-field__native {
  color: #ffffff !important;
}
</style>
