<template>
  <q-dialog v-model="dialogVisible">
    <q-card style="min-width: 420px; max-width: 90vw">
      <q-card-section>
        <div class="text-h6">Connections</div>
      </q-card-section>

      <q-card-section class="q-pt-sm">
        <div class="q-gutter-md">
          <div class="text-subtitle2 q-mb-sm">Manage external connections and integrations</div>
          <div class="row items-center q-gutter-sm">
            <div class="col">No devices configured.</div>
            <div class="col-auto" style="position: relative">
              <q-btn ref="addBtn" dense label="Add Device" color="primary" @click="openAddMenu" />

              <div v-if="addMenu" :style="addMenuStyle" class="connections-menu use-default">
                <div
                  style="
                    padding: 6px 0;
                    width: 220px;
                    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12);
                    background: var(--q-popup-bg, #fff);
                    border-radius: 6px;
                  "
                >
                  <div class="q-list">
                    <q-item
                      clickable
                      role="button"
                      @click="createDevice('Bluetooth')"
                      style="padding: 8px 12px; cursor: pointer"
                    >
                      <q-item-section avatar style="width: 32px">
                        <q-icon name="bluetooth" />
                      </q-item-section>
                      <q-item-section>Bluetooth</q-item-section>
                    </q-item>

                    <q-item
                      clickable
                      role="button"
                      @click="createDevice('LAN')"
                      style="padding: 8px 12px; cursor: pointer"
                    >
                      <q-item-section avatar style="width: 32px">
                        <q-icon name="wifi" />
                      </q-item-section>
                      <q-item-section>Wi‑Fi area / LAN</q-item-section>
                    </q-item>

                    <q-item
                      clickable
                      role="button"
                      @click="createDevice('Internet')"
                      style="padding: 8px 12px; cursor: pointer"
                    >
                      <q-item-section avatar style="width: 32px">
                        <q-icon name="cloud" />
                      </q-item-section>
                      <q-item-section>Internet</q-item-section>
                    </q-item>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="q-mt-md">
            <q-item v-for="d in devices" :key="d.id">
              <q-item-section>
                <div class="row items-center">
                  <div class="col">
                    {{ d.name }}
                    <span class="text-caption text-grey-7 q-ml-sm">({{ d.type }})</span>
                  </div>
                  <div class="col-auto">
                    <q-btn dense flat icon="delete" color="negative" @click="removeDevice(d.id)" />
                  </div>
                </div>
              </q-item-section>
            </q-item>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat label="Close" color="primary" @click="close" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>();

const dialogVisible = computed({
  get: () => !!props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
});

const devices = ref<Array<{ id: string; name: string; type?: string }>>([]);
const addMenu = ref(false);
const addBtn = ref<any>(null);
const addMenuStyle = ref<Record<string, string>>({
  position: 'fixed',
  left: '0px',
  top: '0px',
  zIndex: '20020',
});

function createDevice(type: string) {
  const id = String(Date.now());
  devices.value.push({ id, name: `${type} Device ${devices.value.length + 1}`, type });
  addMenu.value = false;
}

function openAddMenu() {
  try {
    const el = addBtn.value;
    let dom: HTMLElement | null = null;
    if (!el) {
      dom = null;
    } else if (el.$el && typeof el.$el.getBoundingClientRect === 'function') {
      dom = el.$el as HTMLElement;
    } else if (typeof el.getBoundingClientRect === 'function') {
      dom = el as HTMLElement;
    }

    if (!dom) {
      addMenuStyle.value = { position: 'fixed', left: '8px', top: '8px', zIndex: '20020' };
      addMenu.value = true;
      return;
    }
    const r = dom.getBoundingClientRect();
    const width = 220;
    const left = Math.min(Math.max(8, r.right - width), window.innerWidth - width - 8);
    const top = Math.min(window.innerHeight - 40, r.bottom + 6);
    addMenuStyle.value = { position: 'fixed', left: `${left}px`, top: `${top}px`, zIndex: '20020' };
    addMenu.value = true;
  } catch (e) {
    addMenu.value = true;
  }
}

function removeDevice(id: string) {
  devices.value = devices.value.filter((d) => d.id !== id);
}

function close() {
  dialogVisible.value = false;
}
</script>

<style scoped></style>

<style scoped>
::v-deep .connections-menu {
  z-index: 20020 !important;
}
::v-deep .connections-menu .q-menu__content {
  z-index: 20020 !important;
}

/* Force readable popup background and text color in case global theme overrides them */
::v-deep .connections-menu > div {
  background: var(--q-popup-bg, #ffffff) !important;
  color: var(--q-default-text, #000000) !important;
  -webkit-font-smoothing: antialiased;
}
::v-deep .connections-menu .q-item,
::v-deep .connections-menu .q-item-type {
  color: var(--q-default-text, #000000) !important;
}

/* Custom inline menu items styling */
.connections-menu .q-item {
  padding: 8px 12px;
}
.connections-menu .q-item:hover {
  background: rgba(0, 0, 0, 0.04);
}
</style>
