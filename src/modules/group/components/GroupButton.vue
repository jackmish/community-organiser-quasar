<template>
  <div>
    <q-btn
      :dense="size === 'small'"
      :unelevated="true"
      :round="round"
      class="group-button"
      :class="{ selected: selected }"
      :title="title"
      @click.stop.prevent="handleClick"
      :style="btnStyle"
    >
      <q-icon
        :name="group?.icon || 'folder_open'"
        :style="`color: ${textColor} !important; fill: ${textColor} !important; stroke: ${textColor} !important;`"
      />
      <span :style="{ color: textColor }" class="label-text">{{ displayLabel }}</span>
      <q-icon v-if="hasMenu" name="arrow_drop_down" />
    </q-btn>

    <q-menu v-if="hasMenu" v-model="menuOpen" auto-close>
      <div style="padding: 6px">
        <group-tree-selector :groups="groups" @select="onSelect" />
      </div>
    </q-menu>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { getContrastColor, darkenHex } from "src/utils/colorUtils";
import GroupTreeSelector from "./GroupTreeSelector.vue";

const props = defineProps<{
  group?: any;
  groups?: any[];
  size?: "small" | "normal";
  label?: string;
  round?: boolean;
  selected?: boolean;
  title?: string;
}>();

const emit = defineEmits<{
  (e: "select", group: any): void;
  (e: "click"): void;
}>();

const menuOpen = ref(false);

function onSelect(g: any) {
  menuOpen.value = false;
  emit("select", g);
}

function handleClick() {
  if (hasMenu.value) {
    menuOpen.value = !menuOpen.value;
  } else {
    emit("click");
  }
}

const hasMenu = computed(() => Array.isArray(props.groups) && props.groups.length > 0);

const displayLabel = computed(() => {
  if (props.label) return props.label;
  if (!props.group) return "";
  return props.group.name ?? props.group.label ?? "";
});

const textColor = computed(() => {
  try {
    if (!props.group) return "inherit";
    return (
      props.group.textColor ||
      props.group.text_color ||
      (props.group.color ? getContrastColor(props.group.color) : "inherit")
    );
  } catch (e) {
    return "inherit";
  }
});

const btnStyle = computed(() => {
  try {
    const base = props.group?.color || "transparent";
    const border = props.group?.color
      ? darkenHex(props.group.color, 0.35)
      : "transparent";
    return `background-color: ${base} !important; border:1px solid ${border}; padding: 2px 8px; min-height: 24px; display: inline-flex; align-items: center; gap: 8px; background-image: none !important; box-shadow: none !important;`;
  } catch (e) {
    return "";
  }
});

const size = props.size || "normal";
const round = props.round ?? false;
</script>

<style scoped>
.group-button {
  border-radius: 6px;
  padding: 2px 6px !important;
  font-size: 0.88rem;
  min-height: 24px;
  display: inline-flex;
  align-items: center;
}
.label-text {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.group-button.selected {
  opacity: 1;
  filter: none;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  outline-offset: 2px;
  outline: none;
  pointer-events: none;
  cursor: default;
}
</style>
