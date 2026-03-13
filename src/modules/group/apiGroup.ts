import { markRaw, ref } from 'vue';
import { defineStore } from 'pinia';
import { saveData } from 'src/utils/storageUtils';
import * as groupManager from './groupManager';
import { GroupList } from './GroupList';
import { GroupActive } from './GroupActive';

// ── Store class ───────────────────────────────────────────────────────────────
class GroupStore {
  readonly groups = ref<any[]>([]);
  readonly activeGroupRef = ref<{ label: string; value: string | null } | null>(null);
  readonly list = markRaw(new GroupList(this.groups, this.activeGroupRef));
  readonly active = markRaw(new GroupActive(this.groups, this.activeGroupRef));

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
