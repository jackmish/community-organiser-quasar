import type { SyncContractSnapshot } from './syncContractSettings';

/** Fired after device/group role assignments change (e.g. JoinMember dialog closed). */
export const SYNC_CONTRACT_REVIEW_EVENT = 'co21:sync-contract-review';

/** Restore sync confirm baseline after canceling a pending send-contract action. */
export const SYNC_BASELINE_RESTORE_EVENT = 'co21:sync-baseline-restore';

export function dispatchBaselineRestore(baseline: SyncContractSnapshot | null): void {
  window.dispatchEvent(
    new CustomEvent<{ baseline: SyncContractSnapshot | null }>(SYNC_BASELINE_RESTORE_EVENT, {
      detail: { baseline },
    }),
  );
}

export type SyncContractReviewReason = 'assign_closed' | 'profiles_saved';

export type SyncContractReviewDetail = {
  reason: SyncContractReviewReason;
};

export const SYNC_CAPTURE_BASELINE_EVENT = 'co21:sync-capture-baseline';

export function dispatchCaptureSyncBaseline(): void {
  window.dispatchEvent(new Event(SYNC_CAPTURE_BASELINE_EVENT));
}

export function dispatchSyncContractReview(reason: SyncContractReviewReason): void {
  window.dispatchEvent(
    new CustomEvent<SyncContractReviewDetail>(SYNC_CONTRACT_REVIEW_EVENT, {
      detail: { reason },
    }),
  );
}
