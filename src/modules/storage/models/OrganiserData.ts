import type { DayData } from '../../task/models/classes/DayData';
import type { Group } from '../../group/models/GroupModel';

export class OrganiserData {
  days: Record<string, DayData>;
  groups: Group[];
  lastModified: string;

  constructor(init?: Partial<OrganiserData>) {
    this.days = init?.days ?? {};
    this.groups = init?.groups ?? [];
    this.lastModified = init?.lastModified ?? new Date().toISOString();
  }
}
