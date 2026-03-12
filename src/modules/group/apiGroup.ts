import { markRaw, ref } from 'vue';
import { defineStore } from 'pinia';
import { saveData } from 'src/utils/storageUtils';
import * as groupManager from './groupManager';
import { GroupList } from './GroupList';
import { GroupActive } from './GroupActive';

// ── Store ─────────────────────────────────────────────────────────────────────
export const useGroupStore = defineStore('group', () => {
  const groups = ref<any[]>([]);
  const activeGroupRef = ref<{ label: string; value: string | null } | null>(null);
  const list = markRaw(new GroupList(groups, activeGroupRef));
  const active = markRaw(new GroupActive(groups, activeGroupRef));

  return {
    list,
    active,

    async add(payload: any) {
      const group = groupManager.addGroup(groups.value, payload);
      await saveData();
      return group;
    },

    async update(groupId: string, updates: Partial<any>) {
      groupManager.updateGroup(groups.value, groupId, updates);
      await saveData();
    },

    async delete(groupId: string) {
      const res = groupManager.deleteGroup(groups.value, groupId);
      await saveData();
      return res;
    },
  };
});
