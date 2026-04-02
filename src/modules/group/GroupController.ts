import { markRaw, ref } from 'vue';
import { defineStore } from 'pinia';
import { saveData } from 'src/utils/storageUtils';
import * as groupRepository from './managers/groupRepository';
import type { CreateGroupInput } from './managers/groupRepository';
import { GroupList } from './models/classes/GroupList';
import { GroupActive } from './models/classes/GroupActive';
import type { Group } from './models/GroupModel';

class GroupController {
  readonly groups = ref<Group[]>([]);
  readonly activeGroupRef = ref<{ label: string; value: string | null } | null>(null);
  readonly list = markRaw(new GroupList(this.groups as any, this.activeGroupRef));
  readonly active = markRaw(new GroupActive<Group>(this.groups as any, this.activeGroupRef));

  async add(payload: CreateGroupInput) {
    const group = groupRepository.addGroup(this.groups.value, payload);
    await saveData();
    return group;
  }

  async update(groupId: string, updates: Partial<Omit<Group, 'id' | 'createdAt'>>) {
    groupRepository.updateGroup(this.groups.value, groupId, updates);
    await saveData();
  }

  async delete(groupId: string) {
    const res = groupRepository.deleteGroup(this.groups.value, groupId);
    await saveData();
    return res;
  }
}

export const GroupStoreController = defineStore('group', () => new GroupController());
export type GroupControllerInstance = ReturnType<typeof GroupStoreController>;
