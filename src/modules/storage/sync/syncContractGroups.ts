import CC from 'src/CCAccess';
import { GroupModel, type Group } from 'src/modules/group/models/GroupModel';
import { normalizeGroupStyleFields } from 'src/modules/group/utils/groupStyleUtils';
import type { SyncContractSnapshot } from './syncContractSettings';

type SnapshotGroup = NonNullable<SyncContractSnapshot['groups']>[number];

function ccGroupById(id: string) {
  return (CC.group?.list?.all?.value ?? []).find((g) => String(g.id) === id);
}

function applySnapshotFieldsToGroup(
  target: Group,
  sg: SnapshotGroup,
  ccGroup?: ReturnType<typeof ccGroupById>,
): void {
  if (sg.name) target.name = sg.name;
  if (sg.icon) target.icon = target.icon || sg.icon;
  const style = normalizeGroupStyleFields({
    color: sg.color ?? ccGroup?.color,
    textColor: sg.textColor ?? ccGroup?.textColor,
  });
  if (style.color && !target.color) target.color = style.color;
  if (style.textColor && !target.textColor) target.textColor = style.textColor;
  if (sg.parentId != null && target.parentId == null) target.parentId = sg.parentId ?? undefined;
  if (sg.layoutColorize !== undefined && target.layoutColorize === undefined) {
    target.layoutColorize = sg.layoutColorize;
  }
  if (sg.backgroundColorize !== undefined && target.backgroundColorize === undefined) {
    target.backgroundColorize = sg.backgroundColorize;
  }
  if (sg.calendarColorize !== undefined && target.calendarColorize === undefined) {
    target.calendarColorize = sg.calendarColorize;
  }
  if (sg.shareSubgroups !== undefined && target.shareSubgroups === undefined) {
    target.shareSubgroups = sg.shareSubgroups;
  }
  if (sg.hideTasksFromParent !== undefined && target.hideTasksFromParent === undefined) {
    target.hideTasksFromParent = sg.hideTasksFromParent;
  }
  if (sg.shortcut !== undefined && target.shortcut === undefined) target.shortcut = sg.shortcut;
  if (sg.backgroundImage && !target.backgroundImage) target.backgroundImage = sg.backgroundImage;
  if (ccGroup) {
    if (ccGroup.layoutColorize !== undefined && target.layoutColorize === undefined) {
      target.layoutColorize = ccGroup.layoutColorize;
    }
    if (ccGroup.backgroundColorize !== undefined && target.backgroundColorize === undefined) {
      target.backgroundColorize = ccGroup.backgroundColorize;
    }
    if (ccGroup.calendarColorize !== undefined && target.calendarColorize === undefined) {
      target.calendarColorize = ccGroup.calendarColorize;
    }
    if (ccGroup.shareSubgroups !== undefined && target.shareSubgroups === undefined) {
      target.shareSubgroups = ccGroup.shareSubgroups;
    }
    if (ccGroup.hideTasksFromParent !== undefined && target.hideTasksFromParent === undefined) {
      target.hideTasksFromParent = ccGroup.hideTasksFromParent;
    }
    if (ccGroup.shortcut !== undefined && target.shortcut === undefined) target.shortcut = ccGroup.shortcut;
    if (ccGroup.backgroundImage && !target.backgroundImage) {
      target.backgroundImage = ccGroup.backgroundImage;
    }
    if (ccGroup.color && !target.color) target.color = ccGroup.color;
    if (ccGroup.textColor && !target.textColor) target.textColor = ccGroup.textColor;
    if (ccGroup.icon && !target.icon) target.icon = ccGroup.icon;
  }
}

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
    if (!id) continue;
    const ccGroup = ccGroupById(id);
    const existing = byId.get(id);
    if (existing) {
      applySnapshotFieldsToGroup(existing, sg, ccGroup);
      changed = true;
      continue;
    }
    const init: Partial<GroupModel> & { id: string; name: string } = {
      id,
      name: sg.name || ccGroup?.name || id,
    };
    if (sg.icon || ccGroup?.icon) init.icon = sg.icon || ccGroup?.icon;
    const style = normalizeGroupStyleFields({
      color: sg.color ?? ccGroup?.color,
      textColor: sg.textColor ?? ccGroup?.textColor,
    });
    if (style.color) init.color = style.color;
    if (style.textColor) init.textColor = style.textColor;
    if (sg.parentId != null) init.parentId = sg.parentId ?? undefined;
    else if (ccGroup?.parentId) init.parentId = ccGroup.parentId;
    const row = new GroupModel(init);
    applySnapshotFieldsToGroup(row, sg, ccGroup);
    byId.set(id, row);
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
