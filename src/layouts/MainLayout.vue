<template>
  <q-layout
    view="lHh Lpr lFf"
    class="co21-main-layout"
    :class="{ 'co21-main-layout--schedule': todoScheduleActive }"
  >
    <Co21AppBackground :visible-slot="visibleSlot" :layer0="layer0" :layer1="layer1" />
    <q-header v-if="!todoScheduleActive" class="co21-app-header" :style="mainToolbarStyle">
      <q-toolbar class="co21-header-toolbar">
        <q-toolbar-title style="display: flex; align-items: center; gap: 12px; overflow: visible">
          <div class="co21-header-logo">
            <img src="icons/co21-logo.png" alt="CO21" />
          </div>

          <div id="co21-header-notifications" class="notification-wrapper">
            <SyncContractIncomingNotification :show="showIncomingContract" :proposer-name="incomingProposerName"
              @review="openIncomingContractReview" />
            <SyncContractRevokedNotification
              :show="showRevokedContract"
              :banner-text="revokedContractBannerText"
              @open="openConnectionsAfterRevoked"
            />
            <NextEventNotification style="min-width: 0; flex: 1" />
          </div>
          <div style="margin-left: auto; display: inline-block">
            <q-btn flat dense round icon="menu" class="co21-header-menu-btn"
              style="min-width: 48px; height: 100%; padding: 6px; font-size: 18px" :title="$text('ui.menu')">
              <q-menu v-model="menuOpen" anchor="bottom right" self="top right" style="width: auto">
                <q-list style="min-width: 220px">
                  <q-item>
                    <q-item-section avatar>
                      <q-icon name="language" />
                    </q-item-section>
                    <q-item-section>
                      <q-select style="width: 100%" class="lang-select" use-input hide-selected fill-input dense
                        borderless :input-style="{ paddingLeft: '0', paddingRight: '0' }"
                        popup-content-class="lang-popup" ref="langSelect" v-model="selectedLanguage"
                        :options="filteredLangOptions" option-label="label" option-value="value"
                        v-model:input-value="langFilter" input-debounce="0" emit-value map-options bg-color="blue"
                        @update:model-value="onLanguageChange">
                        <template v-slot:no-option>
                          <q-item>
                            <q-item-section class="text-grey">{{
                              $text('ui.no_results')
                            }}</q-item-section>
                          </q-item>
                        </template>
                      </q-select>
                    </q-item-section>
                  </q-item>
                  <q-separator />
                  <q-item clickable v-ripple @click="openSpaces">
                    <q-item-section avatar>
                      <q-icon name="space_dashboard" />
                    </q-item-section>
                    <q-item-section>{{ $text("menu.spaces") }}</q-item-section>
                  </q-item>
                  <q-item clickable v-ripple @click="openManageHeader">
                    <q-item-section avatar>
                      <q-icon name="folder_special" />
                    </q-item-section>
                    <q-item-section>{{ $text("ui.manage_groups") }}</q-item-section>
                  </q-item>
                  <q-item clickable v-ripple @click="
                    () => {
                      showConnectionsDialog = true;
                      menuOpen = false;
                    }
                  ">
                    <q-item-section avatar>
                      <q-icon name="devices" />
                    </q-item-section>
                    <q-item-section>{{ $text("menu.connections") }}</q-item-section>
                  </q-item>
                  <q-item v-if="pendingActionsCount > 0" clickable v-ripple @click="openPendingActionsFromMenu">
                    <q-item-section avatar>
                      <q-icon name="hourglass_top" />
                    </q-item-section>
                    <q-item-section>{{ pendingActionsMenuLabel }}</q-item-section>
                  </q-item>
                  <q-item clickable v-ripple @click="openAccounts">
                    <q-item-section avatar>
                      <q-icon name="login" />
                    </q-item-section>
                    <q-item-section>{{ $text("menu.accounts") }}</q-item-section>
                  </q-item>
                  <q-item clickable v-ripple @click="openSettings">
                    <q-item-section avatar>
                      <q-icon name="settings" />
                    </q-item-section>
                    <q-item-section>{{ $text("menu.settings") }}</q-item-section>
                  </q-item>

                  <q-item clickable v-ripple @click="
                    () => {
                      showDebugDialog = true;
                      menuOpen = false;
                    }
                  ">
                    <q-item-section avatar>
                      <q-icon name="build" />
                    </q-item-section>
                    <q-item-section>{{ $text("menu.debug_tools") }}</q-item-section>
                  </q-item>

                  <q-item clickable v-ripple @click="reloadWithTestData">
                    <q-item-section avatar>
                      <q-icon name="help_outline" />
                    </q-item-section>
                    <q-item-section>{{ $text("menu.explain_features") }}</q-item-section>
                  </q-item>
                  <q-item clickable v-ripple @click="openAbout">
                    <q-item-section avatar>
                      <q-icon name="info" />
                    </q-item-section>
                    <q-item-section>{{ $text("menu.about") }} v{{ appVersion }}</q-item-section>
                  </q-item>
                  <q-separator />
                  <q-item clickable v-ripple @click="openInfoscreenSettings">
                    <q-item-section avatar>
                      <q-icon name="tv" />
                    </q-item-section>
                    <q-item-section>{{ $text("menu.infoscreen") }}</q-item-section>
                  </q-item>
                </q-list>
              </q-menu>
            </q-btn>
          </div>
        </q-toolbar-title>

        <AppConfigDialog v-model="showConfigDialog" />
        <ConnectionsDialog v-model="showConnectionsDialog" />
        <RolesSetupDialog v-model="showRolesSetupDialog" :initial-action="rolesSetupInitialAction"
          @saved="onRolesSetupSaved" @open-role-assignment="onRolesSetupOpenRoleAssignment" />
        <JoinMemberDialog v-model="showJoinMemberDialog" @open-roles-setup="onJoinMemberOpenRolesSetup" />
        <SyncContractHost />
        <PendingActionsDialog v-model="showPendingActionsDialog" :actions="pendingActionsList" :sync-runs="syncRunsList"
          @run-now="onPendingRunNow" @cancel="onPendingCancel" />
        <AboutDialog v-model="showAboutDialog" />
        <DebugToolsDialog v-model="showDebugDialog" />
        <AccountsDialog v-model="showAccountsDialog" focus-section="space" :focus-section-active="accountsFocusSpace" />
        <SpaceManagementDialog
          v-model="showSpacesDialog"
          :initial-mode="spacesInitialMode"
          :relocate-space-id="spacesRelocateId"
          :switch-after-register="spacesSwitchAfterRegister"
          @open-services="openSpaceServices"
        />
        <InfoscreenSettingsDialog v-model="showInfoscreenDialog" />
        <InfoscreenHost />
      </q-toolbar>

    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>

  </q-layout>
</template>

<script setup lang="ts">
import "src/utils/logger-shim";
import { ref, onMounted, onUnmounted, computed, watch, nextTick, type Ref } from "vue";
import { $text } from "src/modules/lang";
import { app } from "src/services/appService";
import {
  setLocale,
  detectAndSetLocale,
  changeLocale,
  loadSavedLocale,
} from "src/modules/lang";
import { langOptions } from "src/modules/lang/options";
import pkg from "../../package.json";
// Import package.json so the renderer can display the app version reliably
import { useRouter, useRoute } from "vue-router";
import NextEventNotification from "src/modules/task/components/list/NextEventNotification.vue";
import CC from "src/CCAccess";
import Co21AppBackground from "src/components/ui/Co21AppBackground.vue";
import { useGroupPageBackground } from "src/composables/useGroupPageBackground";
import { useGroupColor } from "src/composables/useGroupColor";
import AppConfigDialog from "src/components/settings/AppConfigDialog.vue";
import AboutDialog from "src/components/settings/AboutDialog.vue";
import ConnectionsDialog from "src/components/settings/ConnectionsDialog.vue";
import RolesSetupDialog from "src/components/settings/RolesSetupDialog.vue";
import JoinMemberDialog from "src/components/settings/JoinMemberDialog.vue";
import { dispatchOpenRolesSetup } from "src/modules/storage/sync/rolesSetupUi";
import SyncContractHost from "src/components/settings/SyncContractHost.vue";
import SyncContractIncomingNotification from "src/components/settings/SyncContractIncomingNotification.vue";
import SyncContractRevokedNotification from "src/components/settings/SyncContractRevokedNotification.vue";
import { useSyncContractIncomingNotice } from "src/composables/useSyncContractIncomingNotice";
import { useSyncContractRevokedNotice } from "src/composables/useSyncContractRevokedNotice";
import PendingActionsDialog from "src/components/settings/PendingActionsDialog.vue";
import DebugToolsDialog from "src/components/settings/DebugToolsDialog.vue";
import AccountsDialog from "src/modules/user/components/AccountsDialog.vue";
import SpaceManagementDialog from "src/modules/space/components/SpaceManagementDialog.vue";
import {
  OPEN_CONNECTIONS_DIALOG_EVENT,
  OPEN_SPACES_DIALOG_EVENT,
  type OpenSpacesDialogDetail,
  type OpenSpacesDialogMode,
} from "src/modules/space/spaceUi";
import { spaceAuthBlocked, useSpaceAuth } from "src/composables/useSpaceAuth";
import InfoscreenSettingsDialog from "src/modules/infoscreen/components/InfoscreenSettingsDialog.vue";
import InfoscreenHost from "src/modules/infoscreen/components/InfoscreenHost.vue";
import {
  OPEN_INFOSCREEN_SETTINGS_EVENT,
} from "src/modules/infoscreen/infoscreenUi";
import { usePendingActions } from "src/composables/usePendingActions";
import { useSyncRuns } from "src/composables/useSyncRuns";
import {
  startLanDataSyncScheduler,
  stopLanDataSyncScheduler,
} from "src/modules/storage/sync/lanDataSyncScheduler";
import { appNotify } from "src/utils/appNotify";
import { dispatchBaselineRestore } from "src/modules/storage/sync/syncContractUi";
import {
  OPEN_PENDING_ACTIONS_EVENT,
  startPendingActionsScheduler,
  stopPendingActionsScheduler,
} from "src/modules/storage/sync/syncPendingActions";
import {
  loadConnectedDevices,
  loadOwnDeviceMeta,
  mergeLocalDeviceIntoList,
} from "src/modules/storage/sync/deviceRoleAssignment";
import { loadCo21Settings } from "src/modules/storage/sync/roleProfileSettings";
import { refreshLanServerForConnections } from "src/modules/lan/lanServerManager";
import {
  LAN_PAIRING_PENDING_EVENT,
  LAN_PAIRED_EVENT,
  parseLanPendingDetail,
  parseLanPairedPayload,
  stashLanPendingOffer,
  type LanPairedDevicePayload,
} from "src/modules/lan/lanPairingUi";
import { persistPairedLanDevice } from "src/modules/lan/lanPairingRegister";
// sample data is loaded by the presentation manager when requested
import { presentation } from "src/modules/presentation/presentationRepository";
import { todoCalendarSchedule } from "src/composables/useTodoCalendarSchedule";
const isOnline = ref(false);
let checkInterval: number | undefined;
let lanPairingCompleteUnsub: (() => void) | null = null;
const showConfigDialog = ref(false);
const showAboutDialog = ref(false);
const showConnectionsDialog = ref(false);
const showRolesSetupDialog = ref(false);
const showJoinMemberDialog = ref(false);
const rolesSetupInitialAction = ref<"none" | "new">("none");
const showDebugDialog = ref(false);
const showAccountsDialog = ref(false);
const accountsFocusSpace = ref(false);
const showSpacesDialog = ref(false);
const spacesInitialMode = ref<OpenSpacesDialogMode | null>(null);
const spacesRelocateId = ref<string | null>(null);
const spacesSwitchAfterRegister = ref(false);
const showInfoscreenDialog = ref(false);
const showPendingActionsDialog = ref(false);

const { checked: spaceAuthChecked } = useSpaceAuth();

watch(spaceAuthBlocked, (blocked) => {
  if (!blocked && spaceAuthChecked.value) {
    startBackgroundServices();
  }
});

let backgroundServicesStarted = false;

function startBackgroundServices(): void {
  if (backgroundServicesStarted) return;
  backgroundServicesStarted = true;
  startPendingActionsScheduler(async () => {
    const local = await loadOwnDeviceMeta();
    const loaded = await loadConnectedDevices();
    return mergeLocalDeviceIntoList(loaded, local);
  });
  startLanDataSyncScheduler();
  window.addEventListener(OPEN_PENDING_ACTIONS_EVENT, onOpenPendingActionsEvent);
  window.addEventListener(LAN_PAIRED_EVENT, onLanPairedGlobal as EventListener);
  window.addEventListener(LAN_PAIRING_PENDING_EVENT, onLanPairingPendingGlobal as EventListener);
  const elan = (window as Window & {
    electronLan?: { onPairingComplete?: (cb: (d: Record<string, unknown>) => void) => () => void };
  }).electronLan;
  if (elan?.onPairingComplete) {
    lanPairingCompleteUnsub = elan.onPairingComplete(() => {
      /* co21-lan-paired is dispatched from preload */
    });
  }

  void (async () => {
    try {
      const local = await loadOwnDeviceMeta();
      const loaded = await loadConnectedDevices();
      const devices = mergeLocalDeviceIntoList(loaded, local);
      const settings = await loadCo21Settings();
      const ownName =
        typeof settings.ownDeviceName === "string" ? settings.ownDeviceName : local.name;
      await refreshLanServerForConnections(devices, ownName, { skipReconcileProbe: true });
    } catch {
      void 0;
    }
  })();

  updateOnlineStatus();
  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", () => {
    isOnline.value = false;
  });

  try {
    headerManageHandler = () => {
      try {
        if (route.path === "/") {
          window.dispatchEvent(new Event("group:manage"));
          setTimeout(() => window.dispatchEvent(new Event("group:manage")), 300);
          return;
        }
        router.push("/").then(() => {
          window.dispatchEvent(new Event("group:manage"));
          setTimeout(() => window.dispatchEvent(new Event("group:manage")), 400);
        });
      } catch (e) {
        try {
          window.dispatchEvent(new Event("group:manage"));
        } catch (err) {
          void err;
        }
      }
    };
    window.addEventListener("group:manage-request", headerManageHandler as EventListener);
    window.addEventListener("co21:open-roles-setup", openRolesSetupDialog as EventListener);
    window.addEventListener(
      OPEN_INFOSCREEN_SETTINGS_EVENT,
      onOpenInfoscreenSettingsEvent as EventListener,
    );
  } catch (e) {
    void e;
  }
}

const {
  actions: pendingActionsList,
  count: pendingActionsCount,
  refresh: refreshPendingActions,
  runNow: runPendingActionNow,
  cancelPendingAction: cancelPendingActionById,
} = usePendingActions();

const {
  show: showIncomingContract,
  proposerName: incomingProposerName,
  openReview: openIncomingContractReview,
} = useSyncContractIncomingNotice();

const {
  show: showRevokedContract,
  bannerText: revokedContractBannerText,
  dismiss: dismissRevokedContractNotice,
} = useSyncContractRevokedNotice();

const { runs: syncRunsList } = useSyncRuns();

function openConnectionsAfterRevoked(): void {
  dismissRevokedContractNotice();
  showConnectionsDialog.value = true;
}

const pendingActionsMenuLabel = computed(() =>
  $text("sync.pending_actions_menu").replace("{count}", String(pendingActionsCount.value)),
);

function openPendingActionsFromMenu(): void {
  menuOpen.value = false;
  void refreshPendingActions();
  showPendingActionsDialog.value = true;
}

function onOpenPendingActionsEvent(): void {
  void refreshPendingActions();
  showPendingActionsDialog.value = true;
}

function onLanPairingPendingGlobal(ev: Event): void {
  const ce = ev as CustomEvent<Record<string, unknown>>;
  const detail = ce.detail ? parseLanPendingDetail(ce.detail) : null;
  if (!detail) return;
  stashLanPendingOffer(detail);
  showConnectionsDialog.value = true;
  appNotify(
    "info",
    `${detail.remoteName} wants to pair with this device. Open Wi‑Fi / LAN pairing and tap Accept.`,
    { timeout: 12000, position: "top" },
  );
}

function onLanPairedGlobal(ev: Event): void {
  const ce = ev as CustomEvent<Record<string, unknown>>;
  const payload = ce.detail ? parseLanPairedPayload(ce.detail) : null;
  if (payload?.id) {
    void persistPairedLanDevice(payload);
    appNotify("positive", `Paired with ${payload.name}`);
  }
}

async function onPendingRunNow(actionId: string): Promise<void> {
  const ok = await runPendingActionNow(actionId);
  void refreshPendingActions();
  appNotify(
    ok ? "positive" : "warning",
    ok ? $text("sync.pending_action_run_ok") : $text("sync.pending_action_run_fail"),
  );
}

async function onPendingCancel(actionId: string): Promise<void> {
  const baseline = await cancelPendingActionById(actionId);
  dispatchBaselineRestore(baseline);
  void refreshPendingActions();
  appNotify("info", $text("sync.pending_action_cancelled"));
}

function openRolesSetupDialog(ev: Event): void {
  const detail = (ev as CustomEvent<{ createNew?: boolean }>).detail;
  rolesSetupInitialAction.value = detail?.createNew ? "new" : "none";
  showRolesSetupDialog.value = true;
}

watch(showRolesSetupDialog, (open) => {
  if (!open) rolesSetupInitialAction.value = "none";
});

function onRolesSetupSaved(): void {
  window.dispatchEvent(new Event("co21:roles-saved"));
}

function onRolesSetupOpenRoleAssignment(): void {
  showRolesSetupDialog.value = false;
  showJoinMemberDialog.value = true;
}

function onJoinMemberOpenRolesSetup(): void {
  showJoinMemberDialog.value = false;
  dispatchOpenRolesSetup();
}

function onOpenSpacesDialogEvent(ev: Event): void {
  const detail = (ev as CustomEvent<OpenSpacesDialogDetail>).detail ?? {};
  spacesInitialMode.value = detail.mode ?? null;
  spacesRelocateId.value = detail.spaceId ?? null;
  spacesSwitchAfterRegister.value = !!detail.switchAfter;
  showSpacesDialog.value = true;
}

function onOpenConnectionsDialogEvent(): void {
  showConnectionsDialog.value = true;
}

watch(showSpacesDialog, (open) => {
  if (!open) {
    spacesInitialMode.value = null;
    spacesRelocateId.value = null;
    spacesSwitchAfterRegister.value = false;
  }
});
const { visibleSlot, layer0, layer1 } = useGroupPageBackground(
  CC.group.list.all as Ref<unknown[]>,
  CC.group.active.activeGroup as Ref<unknown>,
);

const { mainToolbarStyle } = useGroupColor(
  CC.group.list.all as Ref<any[]>,
  CC.group.active.activeGroup as Ref<{ label: string; value: string | null } | null>,
);

const menuOpen = ref(false);

const todoScheduleActive = computed(() => todoCalendarSchedule.active.value);

watch(
  todoScheduleActive,
  (active) => {
    try {
      document.documentElement.classList.toggle("co21-schedule-mode", active);
    } catch {
      void 0;
    }
    if (active) menuOpen.value = false;
  },
  { immediate: true },
);

const selectedLanguage = ref("en-US");
const langSelect = ref<any>(null);
const filteredLangOptions = ref<any[]>([...langOptions]);
const langFilter = ref("");

// Ensure filter is cleared when menu opens so filtering starts fresh
watch(menuOpen, (val) => {
  if (val) langFilter.value = "";
});

// Update filtered options when the input value changes
watch(
  langFilter,
  (val) => {
    const q = String(val || "")
      .trim()
      .toLowerCase();
    if (!q) {
      filteredLangOptions.value = [...langOptions];
      return;
    }
    filteredLangOptions.value = (langOptions as any[]).filter((o) =>
      (o.label || "").toLowerCase().includes(q)
    );
  },
  { immediate: true }
);

// `langOptions` moved to src/modules/lang/options.ts

let headerManageHandler: any = null;
// Obtain router and route during setup (inject must run inside setup)
const router = useRouter();
const route = useRoute();
const appVersion = ref<string>(pkg?.version || "unknown");

const now = ref(new Date());
let clockTimer: any = null;
onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = new Date();
  }, 1000);
  window.addEventListener(OPEN_SPACES_DIALOG_EVENT, onOpenSpacesDialogEvent as EventListener);
  window.addEventListener(
    OPEN_CONNECTIONS_DIALOG_EVENT,
    onOpenConnectionsDialogEvent as EventListener,
  );
});
onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer);
  window.removeEventListener(OPEN_SPACES_DIALOG_EVENT, onOpenSpacesDialogEvent as EventListener);
  window.removeEventListener(
    OPEN_CONNECTIONS_DIALOG_EVENT,
    onOpenConnectionsDialogEvent as EventListener,
  );
});

async function checkInternetConnection(): Promise<boolean> {
  try {
    // Try to fetch a small resource from a reliable endpoint
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch("https://www.google.com/favicon.ico", {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-cache",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return true;
  } catch (error) {
    return false;
  }
}

function updateOnlineStatus() {
  checkInternetConnection().then((hasInternet) => {
    isOnline.value = hasInternet;
  });
}

onMounted(async () => {
  if (!spaceAuthBlocked.value && spaceAuthChecked.value) {
    startBackgroundServices();
  }
});

watch(
  () => menuOpen.value,
  (val) => {
    if (val) {
      nextTick(() => {
        try {
          if (langSelect.value && typeof langSelect.value.focus === "function") {
            langSelect.value.focus();
          }
        } catch (e) {
          // ignore
        }
      });
    }
  }
);

onMounted(async () => {
  try {
    const locale = await loadSavedLocale();
    selectedLanguage.value = locale;
  } catch (e) {
    try {
      const detected = await detectAndSetLocale();
      selectedLanguage.value = detected.locale;
    } catch (err) {
      selectedLanguage.value = "en-US";
    }
  }
});

async function onLanguageChange(lang: string) {
  try {
    await changeLocale(lang);
  } catch (e) {
    // ignore
  } finally {
    // reset filter and close menu after selection
    filteredLangOptions.value = [...langOptions];
    langFilter.value = "";
    menuOpen.value = false;
  }
}

function openAccounts() {
  accountsFocusSpace.value = false;
  showAccountsDialog.value = true;
  menuOpen.value = false;
}

function openSpaceServices(): void {
  showSpacesDialog.value = false;
  accountsFocusSpace.value = true;
  showAccountsDialog.value = true;
}

watch(showAccountsDialog, (open) => {
  if (!open) accountsFocusSpace.value = false;
});

function openSettings() {
  showConfigDialog.value = true;
  menuOpen.value = false;
}

function openSpaces() {
  showSpacesDialog.value = true;
  menuOpen.value = false;
}

function openManageHeader() {
  try {
    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      window.dispatchEvent(new Event("group:manage-request"));
    }
  } catch (e) {
    // fallback: ignore if dispatch fails
  } finally {
    menuOpen.value = false;
  }
}

function openAbout() {
  showAboutDialog.value = true;
  menuOpen.value = false;
}

function openInfoscreenSettings() {
  showInfoscreenDialog.value = true;
  menuOpen.value = false;
}

function onOpenInfoscreenSettingsEvent(): void {
  showInfoscreenDialog.value = true;
}

async function toggleTestMode() {
  // Enable test mode only. Disallow reverting to normal mode from the UI.
  menuOpen.value = false;
  try {
    if (
      presentation &&
      typeof (presentation as any).enableTestModeWithApi === "function"
    ) {
      await (presentation as any).enableTestModeWithApi(CC);
    } else {
      presentation.toggleTestMode();
    }
  } catch (e) {
    void e;
  }
}

async function startPresentation() {
  menuOpen.value = false;
  try {
    if (
      presentation &&
      typeof (presentation as any).startPresentationWithApi === "function"
    ) {
      await (presentation as any).startPresentationWithApi(CC);
    } else {
      presentation.start();
    }
  } catch (e) {
    void e;
  }
}

async function stopPresentation() {
  menuOpen.value = false;
  try {
    if (
      presentation &&
      typeof (presentation as any).stopPresentationWithApi === "function"
    ) {
      await (presentation as any).stopPresentationWithApi(CC);
    } else {
      presentation.stop();
    }
  } catch (e) {
    void e;
  }
}

async function reloadWithTestData() {
  try {
    menuOpen.value = false;
    if (
      presentation &&
      typeof (presentation as any).enableTestModeWithApi === "function"
    ) {
      await (presentation as any).enableTestModeWithApi(CC);
    } else {
      presentation.toggleTestMode();
    }
  } catch (e) {
    void e;
  }
}

onUnmounted(() => {
  try {
    document.documentElement.classList.remove("co21-schedule-mode");
  } catch {
    void 0;
  }
  if (backgroundServicesStarted) {
    stopPendingActionsScheduler();
    stopLanDataSyncScheduler();
    window.removeEventListener(OPEN_PENDING_ACTIONS_EVENT, onOpenPendingActionsEvent);
    window.removeEventListener(LAN_PAIRED_EVENT, onLanPairedGlobal as EventListener);
    window.removeEventListener(LAN_PAIRING_PENDING_EVENT, onLanPairingPendingGlobal as EventListener);
    lanPairingCompleteUnsub?.();
    lanPairingCompleteUnsub = null;
    window.removeEventListener("online", updateOnlineStatus);
    window.removeEventListener("offline", updateOnlineStatus);
    try {
      if (headerManageHandler)
        window.removeEventListener("group:manage-request", headerManageHandler as EventListener);
    } catch (e) {
      void e;
    }
    window.removeEventListener("co21:open-roles-setup", openRolesSetupDialog as EventListener);
    window.removeEventListener(
      OPEN_INFOSCREEN_SETTINGS_EVENT,
      onOpenInfoscreenSettingsEvent as EventListener,
    );
  }
});

// NextEventNotification component handles computation and display
</script>

<style scoped>
.lang-select .q-field__control,
.lang-select .q-field__native {
  padding-left: 0 !important;
  padding-right: 0 !important;
  box-sizing: border-box;
}

.notification-wrapper {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  overflow: visible;
  gap: 6px;
  flex-wrap: wrap;
}

.notification-wrapper>.sync-incoming-notice-btn {
  flex: 0 0 auto;
  margin-right: 0;
}

/* Ensure the select's background fills the parent but inner text is padded */
.lang-select .q-field {
  background-clip: padding-box;
}

.co21-app-header :deep(.q-header__content),
.co21-header-toolbar {
  background: transparent !important;
}

.co21-header-logo {
  display: flex;
  align-items: center;
}

.co21-header-logo img {
  height: 28px;
  width: auto;
  display: block;
}

.co21-header-toolbar :deep(.co21-header-menu-btn) {
  background: var(--co21-header-accent-bg) !important;
  border-radius: 6px;
}

.co21-header-toolbar :deep(.co21-header-menu-btn .q-icon),
.co21-header-toolbar :deep(#co21-header-notifications .next-events-toggle .q-icon) {
  color: var(--co21-header-fg) !important;
}

.co21-header-toolbar :deep(#co21-header-notifications .next-events-toggle) {
  background: var(--co21-header-accent-bg) !important;
  box-shadow: none;
}
</style>
