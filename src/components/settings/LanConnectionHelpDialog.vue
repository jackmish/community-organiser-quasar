<template>
  <q-dialog :model-value="modelValue" v-bind="dialogBind" @update:model-value="emit('update:modelValue', $event)">
    <q-card :class="cardClass" :style="cardStyle">
      <q-card-section :class="headerClass">
        <div class="text-h6">{{ $text('lan.help.title') }}</div>
        <div class="text-body2 lan-help-intro q-mt-sm">
          {{ introText }}
        </div>
        <div v-if="probeUrl" class="lan-help-probe q-mt-md">
          <div class="text-caption text-weight-medium q-mb-xs">{{ $text('lan.help.probe_label') }}</div>
          <div class="row items-center no-wrap q-gutter-xs">
            <code class="lan-help-probe-url col">{{ probeUrl }}</code>
            <q-btn
              flat
              dense
              round
              size="sm"
              icon="content_copy"
              class="settings-dialog-surface-btn"
              :aria-label="$text('lan.help.copy_probe')"
              @click="copyProbeUrl"
            />
          </div>
        </div>
      </q-card-section>

      <q-card-section :class="[bodyClass, 'q-pt-none']" :style="bodyStyle">
        <q-list bordered separator class="rounded-borders lan-help-sections">
          <q-expansion-item
            v-for="section in sections"
            :key="section.id"
            :model-value="expanded.includes(section.id)"
            expand-separator
            :header-class="sectionHeaderClass(section.id)"
            @update:model-value="(open) => onSectionToggle(section.id, open)"
          >
            <template #header>
              <q-item-section>
                <q-item-label class="text-weight-medium">{{ $text(section.titleKey) }}</q-item-label>
              </q-item-section>
            </template>
            <q-card flat class="lan-help-section-body q-pa-md">
              <pre class="lan-help-pre">{{ sectionBody(section) }}</pre>
            </q-card>
          </q-expansion-item>
        </q-list>
      </q-card-section>

      <q-card-actions align="right" class="q-pt-none">
        <q-btn flat :label="$text('action.close')" color="primary" @click="close" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { copyToClipboard, Notify } from 'quasar';
import { $text, getText } from 'src/modules/lang';
import { CO21_LAN_PAIRING_PORT } from 'src/modules/lan/lanPairingConstants';
import {
  buildLanInfoProbeUrl,
  defaultExpandedLanHelpSections,
  getLanHelpContext,
  orderedLanHelpSections,
  type LanHelpSectionId,
} from 'src/modules/lan/lanConnectionHelp';
import { useSettingsDialogLayout } from 'src/composables/useSettingsDialogLayout';

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    /** LAN IP shown in the quick-test example (first PC address). */
    sampleHost?: string;
  }>(),
  { sampleHost: '' },
);

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
}>();

const { dialogBind, cardClass, cardStyle, headerClass, bodyClass, bodyStyle } =
  useSettingsDialogLayout(560, 680);

const port = CO21_LAN_PAIRING_PORT;
const helpContext = computed(() => getLanHelpContext(port));
const sections = computed(() => orderedLanHelpSections(helpContext.value));
const expanded = ref<LanHelpSectionId[]>([]);

const probeUrl = computed(() => buildLanInfoProbeUrl(props.sampleHost.trim(), port));

const introText = computed(() => formatHelpText('lan.help.intro'));

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      expanded.value = [...defaultExpandedLanHelpSections(helpContext.value)];
    }
  },
  { immediate: true },
);

function formatHelpText(key: string): string {
  const host = props.sampleHost.trim() || '<PC-IP>';
  return getText(key).replaceAll('{port}', String(port)).replaceAll('{host}', host);
}

function sectionBody(section: { bodyKey: string }): string {
  return formatHelpText(section.bodyKey);
}

function sectionHeaderClass(id: LanHelpSectionId): string {
  if (helpContext.value.isDesktopHost && helpContext.value.desktopOs === 'linux' && id === 'linux') {
    return 'lan-help-section-header lan-help-section-header--highlight';
  }
  if (helpContext.value.isDesktopHost && helpContext.value.desktopOs === 'windows' && id === 'windows') {
    return 'lan-help-section-header lan-help-section-header--highlight';
  }
  return 'lan-help-section-header';
}

function onSectionToggle(id: LanHelpSectionId, open: boolean): void {
  if (open) {
    if (!expanded.value.includes(id)) expanded.value = [...expanded.value, id];
    return;
  }
  expanded.value = expanded.value.filter((x) => x !== id);
}

function copyProbeUrl(): void {
  if (!probeUrl.value) return;
  void copyToClipboard(probeUrl.value).then(() => {
    Notify.create({ type: 'positive', message: $text('lan.help.copied_probe'), timeout: 1800 });
  });
}

function close(): void {
  emit('update:modelValue', false);
}
</script>

<style scoped lang="scss">
.lan-help-intro {
  opacity: 0.88;
}

.lan-help-probe-url {
  display: block;
  font-size: 0.78rem;
  word-break: break-all;
  padding: 6px 8px;
  border-radius: 4px;
  background: rgba(127, 127, 127, 0.12);
}

.lan-help-section-body {
  background: transparent;
}

.lan-help-pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.78rem;
  line-height: 1.45;
  opacity: 0.92;
}

:deep(.lan-help-section-header--highlight) {
  background: rgba(76, 175, 80, 0.08);
}
</style>
