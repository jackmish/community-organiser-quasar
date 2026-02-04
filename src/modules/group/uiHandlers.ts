import type { Ref } from 'vue';
import type { TaskGroup } from '../day-organiser/types';

export function createGroupUiHandlers(args: {
  editGroupLocal: Ref<{
    id: string;
    name: string;
    parentId?: string | null;
    color?: string;
  } | null>;
  showEditGroupDialog: Ref<boolean>;
  updateGroup: (
    groupId: string,
    updates: Partial<Omit<TaskGroup, 'id' | 'createdAt'>>,
  ) => Promise<void>;
}) {
  const { editGroupLocal, showEditGroupDialog, updateGroup } = args;

  async function saveEditedGroup() {
    if (!editGroupLocal.value) return;
    const { id, name, parentId, color } = editGroupLocal.value;
    if (!name || !name.trim()) return;
    const updates: Partial<Omit<TaskGroup, 'id' | 'createdAt'>> = {};
    updates.name = name.trim();
    if (parentId !== undefined && parentId !== null) updates.parentId = parentId as any;
    if (color !== undefined && color !== null) updates.color = color as any;
    await updateGroup(id, updates);
    showEditGroupDialog.value = false;
    editGroupLocal.value = null;
  }

  function cancelEditGroup() {
    showEditGroupDialog.value = false;
    editGroupLocal.value = null;
  }

  return { saveEditedGroup, cancelEditGroup } as const;
}
