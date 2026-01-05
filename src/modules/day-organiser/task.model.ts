// Task data model for day-organiser
export type RepeatCycleType = 'dayWeek' | 'month' | 'year' | 'other';

export interface RepeatSettings {
  // cycle type (dayWeek/month/year/...)
  cycleType?: RepeatCycleType;
  // array of weekday keys for dayWeek cycle, e.g. ['mon','wed']
  days?: string[];
  // legacy field names may be present as well
  [key: string]: any;
}

// Task data model for day-organiser
export class Task {
  constructor(
    public id: string,
    public name: string,
    public description: string,
    public status_id: string,
    public type_id: string,
    public created_at: string,
    public updated_at: string,
    public created_by: string,
    public parent_id?: string | null,
    // New: `repeat` column holds repeat settings or null for non-repeating tasks
    public repeat?: RepeatSettings | null,
  ) {}
}
