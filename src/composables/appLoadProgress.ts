import { computed, ref } from 'vue';
import { $text } from 'src/modules/lang';

const STORAGE_KEY = 'co21:appLoadTimings';
const MAX_RUN_HISTORY = 12;

export type LoadPhaseId =
  | 'storage_migration'
  | 'space_auth'
  | 'workspace'
  | 'core_init'
  | 'app_services'
  | 'view_modes'
  | 'organiser_data'
  | 'disk_recovery'
  | 'organiser_finalize';

export interface LoadPhaseDef {
  id: LoadPhaseId;
  labelKey: string;
}

/** Ordered boot + organiser phases shown on the loading screen. */
export const LOAD_PHASES: LoadPhaseDef[] = [
  { id: 'storage_migration', labelKey: 'load.phase.storage_migration' },
  { id: 'space_auth', labelKey: 'load.phase.space_auth' },
  { id: 'workspace', labelKey: 'load.phase.workspace' },
  { id: 'core_init', labelKey: 'load.phase.core_init' },
  { id: 'app_services', labelKey: 'load.phase.app_services' },
  { id: 'view_modes', labelKey: 'load.phase.view_modes' },
  { id: 'organiser_data', labelKey: 'load.phase.organiser_data' },
  { id: 'disk_recovery', labelKey: 'load.phase.disk_recovery' },
  { id: 'organiser_finalize', labelKey: 'load.phase.organiser_finalize' },
];

export interface LoadRunRecord {
  at: string;
  phases: Partial<Record<LoadPhaseId, number>>;
  totalMs: number;
  completed: boolean;
}

interface StoredLoadTimings {
  lastRun: Partial<Record<LoadPhaseId, number>>;
  runs: LoadRunRecord[];
}

const loadRunActive = ref(false);
const currentPhaseId = ref<LoadPhaseId | null>(null);
const currentRunPhases = ref<Partial<Record<LoadPhaseId, number>>>({});
const lastRunPhases = ref<Partial<Record<LoadPhaseId, number>>>(loadStoredTimings().lastRun);
const runHistory = ref<LoadRunRecord[]>(loadStoredTimings().runs);
const phaseStartedAt = ref<number | null>(null);
const tick = ref(0);

let runStartedAt: number | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;

function loadStoredTimings(): StoredLoadTimings {
  if (typeof localStorage === 'undefined') {
    return { lastRun: {}, runs: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lastRun: {}, runs: [] };
    const parsed = JSON.parse(raw) as StoredLoadTimings;
    return {
      lastRun: parsed.lastRun ?? {},
      runs: Array.isArray(parsed.runs) ? parsed.runs.slice(0, MAX_RUN_HISTORY) : [],
    };
  } catch {
    return { lastRun: {}, runs: [] };
  }
}

function persistTimings(lastRun: Partial<Record<LoadPhaseId, number>>, runs: LoadRunRecord[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ lastRun, runs: runs.slice(0, MAX_RUN_HISTORY) }),
    );
  } catch {
    void 0;
  }
}

function startTicking(): void {
  if (tickTimer) return;
  tickTimer = setInterval(() => {
    tick.value += 1;
  }, 100);
}

function stopTicking(): void {
  if (!tickTimer) return;
  clearInterval(tickTimer);
  tickTimer = null;
}

function ensureRunStarted(): void {
  if (loadRunActive.value) return;
  loadRunActive.value = true;
  runStartedAt = Date.now();
  currentRunPhases.value = {};
  currentPhaseId.value = null;
  phaseStartedAt.value = null;
  startTicking();
}

function phaseLabel(id: LoadPhaseId): string {
  const def = LOAD_PHASES.find((p) => p.id === id);
  return def ? $text(def.labelKey) : id;
}

export function beginLoadRun(): void {
  ensureRunStarted();
}

export async function runLoadPhase<T>(id: LoadPhaseId, fn: () => T | Promise<T>): Promise<T> {
  ensureRunStarted();
  currentPhaseId.value = id;
  phaseStartedAt.value = Date.now();
  try {
    return await fn();
  } finally {
    const elapsed = phaseStartedAt.value ? Date.now() - phaseStartedAt.value : 0;
    currentRunPhases.value = {
      ...currentRunPhases.value,
      [id]: (currentRunPhases.value[id] ?? 0) + elapsed,
    };
    phaseStartedAt.value = null;
  }
}

export function finishLoadRun(completed = true): void {
  if (!loadRunActive.value) return;

  if (currentPhaseId.value && phaseStartedAt.value) {
    const id = currentPhaseId.value;
    const elapsed = Date.now() - phaseStartedAt.value;
    currentRunPhases.value = {
      ...currentRunPhases.value,
      [id]: (currentRunPhases.value[id] ?? 0) + elapsed,
    };
  }

  const phases = { ...currentRunPhases.value };
  const totalMs = Object.values(phases).reduce((sum, ms) => sum + (ms ?? 0), 0);
  const record: LoadRunRecord = {
    at: new Date().toISOString(),
    phases,
    totalMs,
    completed,
  };

  if (completed && totalMs > 0) {
    lastRunPhases.value = phases;
  }

  const runs = [record, ...runHistory.value].slice(0, MAX_RUN_HISTORY);
  runHistory.value = runs;
  if (completed && totalMs > 0) {
    persistTimings(phases, runs);
  }

  loadRunActive.value = false;
  currentPhaseId.value = null;
  phaseStartedAt.value = null;
  runStartedAt = null;
  stopTicking();
}

export const showLoadScreen = computed(() => loadRunActive.value);

export const loadCurrentPhaseId = computed(() => currentPhaseId.value);

export const loadCurrentPhaseLabel = computed(() => {
  const id = currentPhaseId.value;
  return id ? phaseLabel(id) : $text('load.phase.starting');
});

export const loadHasPreviousTimings = computed(() => {
  const last = lastRunPhases.value;
  return LOAD_PHASES.some((p) => (last[p.id] ?? 0) > 0);
});

export const loadProgressPercent = computed(() => {
  void tick.value;
  const last = lastRunPhases.value;
  const hasEstimate = LOAD_PHASES.some((p) => (last[p.id] ?? 0) > 0);

  if (!hasEstimate) {
    const completed = LOAD_PHASES.filter(
      (p) => (currentRunPhases.value[p.id] ?? 0) > 0 && p.id !== currentPhaseId.value,
    ).length;
    const currentIdx = currentPhaseId.value
      ? LOAD_PHASES.findIndex((p) => p.id === currentPhaseId.value)
      : 0;
    const inPhase =
      currentPhaseId.value && phaseStartedAt.value
        ? Math.min(0.85, (Date.now() - phaseStartedAt.value) / 1200)
        : 0;
    const total = LOAD_PHASES.length;
    const raw = ((completed + currentIdx * 0.05 + inPhase) / total) * 100;
    return Math.min(96, Math.max(4, Math.round(raw)));
  }

  const expectedTotal = LOAD_PHASES.reduce((sum, p) => sum + (last[p.id] ?? 0), 0);
  if (expectedTotal <= 0) return 8;

  let elapsed = 0;
  for (const phase of LOAD_PHASES) {
    const done = currentRunPhases.value[phase.id] ?? 0;
    if (phase.id === currentPhaseId.value && phaseStartedAt.value) {
      elapsed += done + (Date.now() - phaseStartedAt.value);
      break;
    }
    elapsed += done;
  }

  return Math.min(98, Math.max(4, Math.round((elapsed / expectedTotal) * 100)));
});

export const loadTimingsForDebug = computed(() => ({
  lastRun: lastRunPhases.value,
  runs: runHistory.value,
  currentRun: currentRunPhases.value,
}));

export function formatLoadMs(ms: number | undefined): string {
  if (ms == null || ms <= 0) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
