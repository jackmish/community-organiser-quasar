import { ref } from 'vue';
import {
  isSpaceManagementAvailable,
  loadSpaceRegistrySnapshot,
  type SpaceEntry,
  type SpacePathIssue,
  type SpaceRegistrySnapshot,
} from 'src/modules/space';
import { SYSTEM_SPACE_ID } from 'src/modules/space/models/SpaceModel';

export const missingWorkspaceIssue = ref<SpacePathIssue | null>(null);
export const missingWorkspaceChecked = ref(false);
export const missingWorkspaceAlternatives = ref<SpaceEntry[]>([]);

async function waitForSpaceManagementApi(maxMs = 8000): Promise<boolean> {
  if (isSpaceManagementAvailable()) return true;
  const step = 50;
  for (let elapsed = 0; elapsed < maxMs; elapsed += step) {
    await new Promise((r) => setTimeout(r, step));
    if (isSpaceManagementAvailable()) return true;
  }
  return isSpaceManagementAvailable();
}

export function pickDefaultAlternativeSpaceId(spaces: SpaceEntry[]): string | null {
  if (!spaces.length) return null;
  const system = spaces.find((s) => s.id === SYSTEM_SPACE_ID);
  if (system) return system.id;
  return spaces[0]?.id ?? null;
}

export function listAlternativeSpaces(
  spaces: SpaceEntry[],
  blockedSpaceId: string,
  blockedIds: Set<string>,
): SpaceEntry[] {
  return spaces.filter(
    (s) => s.id !== blockedSpaceId && !blockedIds.has(s.id),
  );
}

/** Active workspace broken, or default-on-start workspace broken. */
export function resolvePrimaryWorkspaceIssue(
  snapshot: SpaceRegistrySnapshot,
): SpacePathIssue | null {
  const issues = snapshot.spacePathIssues ?? [];
  if (!issues.length) return null;

  const byId = new Map(issues.map((i) => [i.spaceId, i]));
  const activeIssue = byId.get(snapshot.registry.activeSpaceId);
  if (activeIssue) return activeIssue;

  const defaultId = snapshot.defaultSpaceId ?? snapshot.registry.defaultSpaceId ?? null;
  if (defaultId) {
    const defaultIssue = byId.get(defaultId);
    if (defaultIssue) return defaultIssue;
  }

  return snapshot.activeSpacePathMissing ?? null;
}

/** Detect workspace folder problems before the organiser UI loads (desktop only). */
export async function checkMissingWorkspace(): Promise<SpacePathIssue | null> {
  missingWorkspaceChecked.value = false;
  missingWorkspaceIssue.value = null;
  missingWorkspaceAlternatives.value = [];

  const ready = await waitForSpaceManagementApi();
  if (!ready) {
    missingWorkspaceChecked.value = true;
    missingWorkspaceIssue.value = null;
    return null;
  }

  try {
    const snapshot = await loadSpaceRegistrySnapshot();
    if (!snapshot) {
      missingWorkspaceIssue.value = null;
      return null;
    }

    const issue = resolvePrimaryWorkspaceIssue(snapshot);
    if (issue) {
      const blockedIds = new Set((snapshot.spacePathIssues ?? []).map((i) => i.spaceId));
      missingWorkspaceAlternatives.value = listAlternativeSpaces(
        snapshot.registry.spaces,
        issue.spaceId,
        blockedIds,
      );
    }
    missingWorkspaceIssue.value = issue;
    return issue;
  } catch {
    missingWorkspaceIssue.value = null;
    return null;
  } finally {
    missingWorkspaceChecked.value = true;
  }
}

export function clearMissingWorkspaceIssue(): void {
  missingWorkspaceIssue.value = null;
  missingWorkspaceAlternatives.value = [];
}
