/**
 * BaseModel — shared base class for all domain models.
 *
 * Provides the common identity and timestamp fields that every persisted
 * record should carry, mirroring the convention of backend models
 * (id, createdAt, updatedAt).
 *
 * Extend this class for each domain model (TaskModel, Group, etc.).
 */
export class BaseModel {
  id: string;
  createdAt: string;
  updatedAt: string;

  constructor(init?: { id?: string; createdAt?: string; updatedAt?: string }) {
    this.id = init?.id ?? crypto.randomUUID();
    this.createdAt = init?.createdAt ?? new Date().toISOString();
    this.updatedAt = init?.updatedAt ?? new Date().toISOString();
  }
}
