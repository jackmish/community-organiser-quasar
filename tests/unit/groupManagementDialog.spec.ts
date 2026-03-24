import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import GroupManagementDialog from '../../src/modules/group/components/GroupManagementDialog.vue';
import CC from '../../src/CentralController';
import * as groupManager from '../../src/modules/group/managers/groupManager';
import * as storageUtils from '../../src/utils/storageUtils';

describe('GroupManagementDialog submit handling', () => {
  let wrapper: any;

  beforeEach(() => {
    // mount component with minimal props and stub GroupForm to emit submit
    wrapper = mount(GroupManagementDialog, {
      props: {
        modelValue: true,
        groupOptions: [],
        groupTree: [],
      },
      global: {
        components: {
          GroupForm: {
            template: '<div />',
            emits: ['submit', 'cancel'],
          },
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    wrapper.unmount();
  });

  it('calls CC.group.add when creating a new group (no editingGroupId)', async () => {
    const addSpy = vi.spyOn(CC.group, 'add');
    (addSpy as any).mockResolvedValue({ id: 'new' });

    // emit submit from stubbed GroupForm
    await wrapper.findComponent({ name: 'GroupForm' }).vm.$emit('submit', { name: 'X' });

    // wait for promises
    await wrapper.vm.$nextTick();

    expect(addSpy).toHaveBeenCalled();
  });

  it('calls CC.group.update when editingGroupId is set', async () => {
    const updateSpy = vi.spyOn(CC.group, 'update');
    (updateSpy as any).mockResolvedValue(undefined);

    // set editingGroupId on component instance
    wrapper.vm.editingGroupId = 'g1';

    await wrapper.findComponent({ name: 'GroupForm' }).vm.$emit('submit', { name: 'Edited' });
    await wrapper.vm.$nextTick();

    expect(updateSpy).toHaveBeenCalledWith('g1', expect.objectContaining({ name: 'Edited' }));
  });

  it('falls back to groupManager.updateGroup when CC.group.update is missing', async () => {
    // temporarily remove update
    const orig = CC.group.update;
    try {
      // @ts-ignore
      CC.group.update = undefined;
      const gmSpy = vi.spyOn(groupManager, 'updateGroup');
      const saveSpy = vi.spyOn(storageUtils, 'saveData');

      wrapper.vm.editingGroupId = 'g2';
      await wrapper.findComponent({ name: 'GroupForm' }).vm.$emit('submit', { name: 'Fallback' });
      await wrapper.vm.$nextTick();

      expect(gmSpy).toHaveBeenCalled();
      expect(saveSpy).toHaveBeenCalled();
    } finally {
      // restore
      // @ts-ignore
      CC.group.update = orig;
    }
  });
});
