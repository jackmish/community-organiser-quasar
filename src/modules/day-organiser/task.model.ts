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
  ) {}
}
