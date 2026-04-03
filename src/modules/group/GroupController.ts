import { markRaw, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { saveData } from 'src/utils/storageUtils';
import * as groupRepository from './managers/groupRepository';
import type { CreateGroupInput } from './managers/groupRepository';
import { GroupList } from './models/classes/GroupList';
import { GroupActive } from './models/classes/GroupActive';
import type { Group } from './models/GroupModel';
import logger from 'src/utils/logger';
import type { Controllable } from 'src/types/Controllable';
import type { StorageController, StoragePort } from 'src/modules/storage/StorageController';

class GroupController implements Controllable {
  readonly controllerName = 'group' as const;
  readonly groups = ref<Group[]>([]);
  readonly activeGroupRef = ref<{ label: string; value: string | null } | null>(null);
  readonly list = markRaw(new GroupList(this.groups as any, this.activeGroupRef));
  readonly active = markRaw(new GroupActive<Group>(this.groups as any, this.activeGroupRef));

  storagePort = (): StoragePort => ({
    kind: 'group',
    data: { active: this.active, list: this.list },
  });

  add = async (payload: CreateGroupInput) => {
    const group = groupRepository.addGroup(this.groups.value, payload);
    await saveData();
    return group;
  };

  update = async (groupId: string, updates: Partial<Omit<Group, 'id' | 'createdAt'>>) => {
    groupRepository.updateGroup(this.groups.value, groupId, updates);
    await saveData();
  };

  delete = async (groupId: string) => {
    const res = groupRepository.deleteGroup(this.groups.value, groupId);
    await saveData();
    return res;
  };

  /**
   * Wire persistent side-effects for the group domain.
   * Called automatically by CC.boot() after all storage ports are connected.
   * Arrow field so Pinia exposes it (prototype methods are stripped).
   */
  onStorageReady = (storage: StorageController): void => {
    try {
      watch(
        () => this.active.activeGroup.value ?? null,
        async (newVal) => {
          try {
            if (storage.isLoading.value) return;
            const existing = (await storage.loadSettings()) ?? {};
            await storage.saveSettings({ ...existing, activeGroupId: newVal?.value ?? null });
          } catch (e) {
            logger.error('[GroupController] failed to persist activeGroup', e);
          }
        },
      );
    } catch (e) {
      void e;
    }
  };
}

export const GroupStoreController = defineStore('group', () => new GroupController());
export type GroupControllerInstance = ReturnType<typeof GroupStoreController>;
