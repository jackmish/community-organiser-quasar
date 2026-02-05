import { computed } from 'vue';
import type { Ref } from 'vue';
import type { OrganiserData } from '../day-organiser/types';
import { getTasksInRange as getTasksInRangeService } from './taskService';

export function createHiddenGroupSummary(
  organiserData: Ref<OrganiserData>,
  activeGroup: Ref<{ label: string; value: string | null } | null>,
) {
  return computed(() => {
    try {
      if (!activeGroup.value || activeGroup.value.value === null)
        return { total: 0, low: 0, medium: 0, high: 0, critical: 0, groups: [] };
      const activeId = String(activeGroup.value.value);
      const getGroupById = (id: any) =>
        (organiserData.value.groups || []).find((g: any) => String(g.id) === String(id));

      const hiddenGroupIds = new Set<string>();
      (organiserData.value.groups || []).forEach((g: any) => {
        try {
          if (!g || !g.id) return;
          if (!g.hideTasksFromParent) return;
          const parent = g.parentId ?? g.parent_id ?? null;
          if (parent && String(parent) === activeId) hiddenGroupIds.add(String(g.id));
        } catch (e) {
          void e;
        }
      });

      if (hiddenGroupIds.size === 0)
        return { total: 0, low: 0, medium: 0, high: 0, critical: 0, groups: [] };

      const groupsMap = new Map<string, any>();
      for (const id of Array.from(hiddenGroupIds)) {
        const g = getGroupById(id) || { id, name: '(unknown)' };
        groupsMap.set(String(id), {
          id: String(id),
          name: g.name || String(id),
          total: 0,
          low: 0,
          medium: 0,
          high: 0,
          critical: 0,
        });
      }

      const all = getTasksInRangeService(organiserData.value, '1970-01-01', '9999-12-31') || [];
      for (const t of all) {
        try {
          if (!t || !t.groupId) continue;
          const gid = String(t.groupId);
          if (!hiddenGroupIds.has(gid)) continue;
          if (Number(t.status_id) === 0) continue; // skip done
          const p = t.priority || 'medium';
          const entry = groupsMap.get(gid);
          if (!entry) continue;
          entry[p] = (entry[p] || 0) + 1;
          entry.total++;
        } catch (e) {
          void e;
        }
      }

      const groupsArr = Array.from(groupsMap.values()).sort((a: any, b: any) =>
        String(a.name).localeCompare(String(b.name)),
      );
      const totals: { total: number; low: number; medium: number; high: number; critical: number } =
        {
          total: 0,
          low: 0,
          medium: 0,
          high: 0,
          critical: 0,
        };
      for (const g of groupsArr) {
        totals.total += g.total || 0;
        totals.low += g.low || 0;
        totals.medium += g.medium || 0;
        totals.high += g.high || 0;
        totals.critical += g.critical || 0;
      }

      return { ...totals, groups: groupsArr };
    } catch (e) {
      return { total: 0, low: 0, medium: 0, high: 0, critical: 0, groups: [] };
    }
  });
}
