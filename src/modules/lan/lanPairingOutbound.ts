import { lanPollUntilResolved } from './lanPairingClient';
import {
  buildLanPairedFromPollPeer,
  dispatchLanPaired,
} from './lanPairingUi';
import { persistPairedLanDevice } from './lanPairingRegister';

export type OutboundPairingJob = {
  baseUrl: string;
  token: string;
  /** IP/host typed or discovered for the remote (used if peer omits LAN addresses). */
  remoteHostHint: string;
};

let activeAbort: AbortController | null = null;

export function cancelOutboundPairingPoll(): void {
  activeAbort?.abort();
  activeAbort = null;
}

export function isOutboundPairingPollActive(): boolean {
  return !!activeAbort && !activeAbort.signal.aborted;
}

/**
 * Poll remote until user accepts (up to 5 min). Survives closing the pairing dialog
 * unless {@link cancelOutboundPairingPoll} is called.
 */
export async function runOutboundPairingPoll(
  job: OutboundPairingJob,
  hooks?: {
    onAccepted?: (deviceName: string) => void;
    onRejected?: () => void;
    onTimeout?: () => void;
  },
): Promise<boolean> {
  cancelOutboundPairingPoll();
  const controller = new AbortController();
  activeAbort = controller;
  const { signal } = controller;

  try {
    const poll = await lanPollUntilResolved(job.baseUrl, job.token, {
      signal,
      timeoutMs: 300_000,
      intervalMs: 500,
      statusTimeoutMs: 10_000,
      continueOnUnknown: true,
    });

    if (signal.aborted) return false;

    if (poll.status === 'accepted' && poll.peer?.deviceId) {
      const payload = buildLanPairedFromPollPeer(poll.peer, job.remoteHostHint);
      await persistPairedLanDevice(payload);
      dispatchLanPaired(payload);
      hooks?.onAccepted?.(payload.name);
      return true;
    }
    if (poll.status === 'rejected') {
      hooks?.onRejected?.();
      return false;
    }
    hooks?.onTimeout?.();
    return false;
  } finally {
    if (activeAbort === controller) {
      activeAbort = null;
    }
  }
}
