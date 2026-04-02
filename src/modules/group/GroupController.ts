import { markRaw, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { saveData } from 'src/utils/storageUtils';
import * as groupRepository from './managers/groupRepository';
import type { CreateGroupInput } from './managers/groupRepository';
import { GroupList } from './models/classes/GroupList';
import { GroupActive } from './models/classes/GroupActive';
import type { Group } from './models/GroupModel';
import type { Ref } from 'vue';
import logger from 'src/utils/logger';

interface SettingsStorage {
  isLoading: Ref<boolean>;
  loadSettings: () => Promise<Record<string, any> | null>;
  saveSettings: (data: Record<string, any>) => Promise<void>;
}

class GroupController {
  readonly groups = ref<Group[]>([]);
  readonly activeGroupRef = ref<{ label: string; value: string | null } | null>(null);
  readonly list = markRaw(new GroupList(this.groups as any, this.activeGroupRef));
  readonly active = markRaw(new GroupActive<Group>(this.groups as any, this.activeGroupRef));

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
   * Call once during app bootstrap after storage is ready.
   * Arrow field so Pinia exposes it (prototype methods are stripped).
   */
  initWatchers = (storage: SettingsStorage): void => {
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
