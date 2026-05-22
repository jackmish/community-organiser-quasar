import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import GroupManagementDialog from '../../src/modules/group/components/GroupManagementDialog.vue';
import CC from 'src/CCAccess';

describe('GroupManagementDialog', () => {
  let wrapper: any;

  beforeEach(() => {
    wrapper = mount(GroupManagementDialog, {
      props: {
        modelValue: true,
        groupOptions: [],
        groupTree: [],
      },
      global: {
        stubs: {
          GroupTreeSelector: { template: '<div class="group-tree-stub" />' },
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    wrapper.unmount();
  });

  it('emits create-group when openCreateGroup is called', async () => {
    await wrapper.vm.openCreateGroup();
    expect(wrapper.emitted('create-group')).toBeTruthy();
  });

  it('emits edit-group with node id when edit is triggered', async () => {
    await wrapper.vm.openEditGroup({ id: 'g1', label: 'Test' });
    expect(wrapper.emitted('edit-group')).toEqual([['g1']]);
  });

  it('calls CC.group.delete on confirm delete', async () => {
    const deleteSpy = vi.spyOn(CC.group, 'delete').mockResolvedValue(undefined as any);
    wrapper.vm.privilegeMode = 'remove';
    await wrapper.vm.$nextTick();
    await wrapper.vm.markPendingDelete('g-del');
    await wrapper.vm.confirmDelete('g-del');
    expect(deleteSpy).toHaveBeenCalledWith('g-del');
  });
});
