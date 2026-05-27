import CC from 'src/CCAccess';
import { GroupModel } from 'src/modules/group/models/GroupModel';
import type { SyncContractSnapshot } from './syncContractSettings';

/** Ensure groups referenced in a signed contract exist in the organiser. */
export async function applyContractSnapshotGroupsToOrganiser(
  snapshot: SyncContractSnapshot,
): Promise<void> {
  const embedded = snapshot.groups;
  if (!embedded?.length) return;
  const local = CC.group?.list?.all?.value ?? [];
  const byId = new Map(local.map((g) => [String(g.id), g]));
  let changed = false;
  for (const sg of embedded) {
    const id = String(sg.id || '').trim();
    if (!id || byId.has(id)) continue;
    const init: Partial<GroupModel> & { id: string; name: string } = {
      id,
      name: sg.name || id,
    };
    if (sg.icon) init.icon = sg.icon;
    if (sg.color) init.color = sg.color;
    if (sg.parentId != null) init.parentId = sg.parentId ?? undefined;
    byId.set(id, new GroupModel(init));
    changed = true;
  }
  if (changed && CC.group?.list?.setGroups) {
    CC.group.list.setGroups([...byId.values()]);
    try {
      if (CC.storage?.saveData) await CC.storage.saveData();
    } catch {
      void 0;
    }
  }
}
