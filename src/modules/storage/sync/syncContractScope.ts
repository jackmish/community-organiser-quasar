import type { SyncContractSnapshot } from './syncContractSettings';

/** Group ids covered by an active sync contract (role assignments on any device). */
export function contractGroupIds(snapshot: SyncContractSnapshot): Set<string> {
  const ids = new Set<string>();
  for (const dev of snapshot.devices) {
    for (const gid of Object.keys(dev.rolesByGroup ?? {})) {
      if (gid) ids.add(gid);
    }
  }
  return ids;
}
