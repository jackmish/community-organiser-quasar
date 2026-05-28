import { co21LanBaseUrl } from 'src/modules/lan/lanPairingConstants';
import { lanPostSyncContractReject } from 'src/modules/lan/lanSyncContract';
import { listCandidateHostsForDevice } from 'src/modules/lan/lanRemoteHost';
import {
  loadOwnDeviceMeta,
  normalizeDeviceId,
  type ConnectedDevice,
} from './deviceRoleAssignment';
import {
  clearSignedSyncContract,
  loadPendingIncomingContract,
  savePendingIncomingContract,
  savePendingOutgoingContract,
} from './syncContractSettings';
import {
  cancelPendingAction,
  dispatchPendingActionsChanged,
  findSendContractAction,
} from './syncPendingActions';
import logger from 'src/utils/logger';

/** Clear local LAN sync contract state and optionally notify the peer. */
export async function revokeLanSyncContractForPeer(
  peer: Pick<ConnectedDevice, 'id' | 'name' | 'lanHost'>,
  opts?: { notifyPeer?: boolean },
): Promise<void> {
  const peerNorm = normalizeDeviceId(peer.id);
  const incoming = await loadPendingIncomingContract();
  if (incoming && normalizeDeviceId(incoming.proposerDeviceId) === peerNorm) {
    await savePendingIncomingContract(null);
  }

  const action = await findSendContractAction();
  if (action) {
    await cancelPendingAction(action.id);
    dispatchPendingActionsChanged();
  }
  await savePendingOutgoingContract(null);
  await clearSignedSyncContract();

  if (opts?.notifyPeer !== false) {
    const local = await loadOwnDeviceMeta();
    const hosts = await listCandidateHostsForDevice(peer as ConnectedDevice);
    for (const host of hosts) {
      const base = co21LanBaseUrl(host);
      if (!base) continue;
      const ok = await lanPostSyncContractReject(base, {
        rejectorDeviceId: local.id,
        rejectorDeviceName: local.name,
        proposerDeviceId: peer.id,
      });
      if (ok) break;
    }
  }

  window.dispatchEvent(new Event('co21:sync-contract-signed'));
  logger.info('[syncContractRevoke] contract revoked for peer', peer.name);
}
