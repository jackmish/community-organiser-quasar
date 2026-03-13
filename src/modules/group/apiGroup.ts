import { markRaw, ref } from 'vue';
import { defineStore } from 'pinia';
import { saveData } from 'src/utils/storageUtils';
import * as groupManager from './groupManager';
import { GroupList } from './GroupList';
import { GroupActive } from './GroupActive';

// ── Store ─────────────────────────────────────────────────────────────────────
export const useGroupStore = defineStore('group', {
  state: () => {
    const groups = ref<any[]>([]);
    const activeGroupRef = ref<{ label: string; value: string | null } | null>(null);
    const list = markRaw(new GroupList(groups, activeGroupRef));
    const active = markRaw(new GroupActive(groups, activeGroupRef));
    return { list, active, groups, activeGroupRef };
  },

  actions: {
    async add(payload: any) {
      const group = groupManager.addGroup(this.groups, payload);
      await saveData();
      return group;
    },

    async update(groupId: string, updates: Partial<any>) {
      groupManager.updateGroup(this.groups, groupId, updates);
      await saveData();
    },

    async delete(groupId: string) {
      const res = groupManager.deleteGroup(this.groups, groupId);
      await saveData();
      return res;
    },
  },
});
