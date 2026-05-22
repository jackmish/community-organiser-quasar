import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import GroupEditDialog from '../../src/modules/group/components/GroupEditDialog.vue';
import CC from 'src/CCAccess';
import * as groupRepository from '../../src/modules/group/managers/groupRepository';
import * as storageUtils from '../../src/utils/storageUtils';

describe('GroupEditDialog submit handling', () => {
  let wrapper: any;

  beforeEach(() => {
    wrapper = mount(GroupEditDialog, {
      props: {
        modelValue: true,
        editingGroupId: null,
      },
      global: {
        components: {
          GroupForm: {
            name: 'GroupForm',
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

  it('calls CC.group.add when creating a new group', async () => {
    const addSpy = vi.spyOn(CC.group, 'add');
    (addSpy as any).mockResolvedValue({ id: 'new' });

    await wrapper.findComponent({ name: 'GroupForm' }).vm.$emit('submit', { name: 'X' });
    await wrapper.vm.$nextTick();

    expect(addSpy).toHaveBeenCalled();
  });

  it('calls CC.group.update when editingGroupId is set', async () => {
    await wrapper.setProps({ editingGroupId: 'g1' });
    const updateSpy = vi.spyOn(CC.group, 'update');
    (updateSpy as any).mockResolvedValue(undefined);

    await wrapper.findComponent({ name: 'GroupForm' }).vm.$emit('submit', { name: 'Edited' });
    await wrapper.vm.$nextTick();

    expect(updateSpy).toHaveBeenCalledWith('g1', expect.objectContaining({ name: 'Edited' }));
  });

  it('falls back to groupRepository.updateGroup when CC.group.update is missing', async () => {
    const orig = CC.group.update;
    try {
      // @ts-ignore
      CC.group.update = undefined;
      await wrapper.setProps({ editingGroupId: 'g2' });
      const gmSpy = vi.spyOn(groupRepository, 'updateGroup');
      const saveSpy = vi.spyOn(storageUtils, 'saveData');

      await wrapper.findComponent({ name: 'GroupForm' }).vm.$emit('submit', { name: 'Fallback' });
      await wrapper.vm.$nextTick();

      expect(gmSpy).toHaveBeenCalled();
      expect(saveSpy).toHaveBeenCalled();
    } finally {
      // @ts-ignore
      CC.group.update = orig;
    }
  });
});
