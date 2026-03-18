import { markRaw, ref } from 'vue';
import { defineStore } from 'pinia';
import { saveData } from 'src/utils/storageUtils';
import * as groupManager from './managers/groupManager';
import { GroupList } from './classes/GroupList';
import { GroupActive } from './classes/GroupActive';
import type { Group } from './classes/Group';

class GroupStore {
  readonly groups = ref<Group[]>([]);
  readonly activeGroupRef = ref<{ label: string; value: string | null } | null>(null);
  readonly list = markRaw(new GroupList(this.groups as any, this.activeGroupRef));
  readonly active = markRaw(new GroupActive<Group>(this.groups as any, this.activeGroupRef));

  async add(payload: any) {
    const group = groupManager.addGroup(this.groups.value, payload);
    await saveData();
    return group;
  }

  async update(groupId: string, updates: Partial<any>) {
    groupManager.updateGroup(this.groups.value, groupId, updates);
    await saveData();
  }

  async delete(groupId: string) {
    const res = groupManager.deleteGroup(this.groups.value, groupId);
    await saveData();
    return res;
  }
}

export const useGroupStore = defineStore('group', () => new GroupStore());
