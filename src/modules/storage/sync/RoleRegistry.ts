/**
 * RoleRegistry — manages the list of sharing roles.
 *
 * Usage:
 *   import { roleRegistry } from 'src/modules/storage/sync/RoleRegistry';
 *   await roleRegistry.init(getSetting, setSetting);
 *   const roles = roleRegistry.getAll();
 *   const forGroup = roleRegistry.getByGroupId('abc');
 */

import logger from '../../../utils/logger';
import { Role } from './RoleModel';
import type { AccessRange, RolePrivilege, RoleData } from './RoleModel';

type SettingsReader = (key: string, fallback: string) => Promise<string>;
type SettingsWriter = (key: string, value: string) => Promise<void>;

const STORAGE_KEY = 'roles';

export class RoleRegistry {
  private _roles: Role[] = [];
  private _read: SettingsReader = async () => '';
  private _write: SettingsWriter = async () => {};
  private _loaded = false;

  // ── Initialisation ──────────────────────────────────────────────────────

  async init(reader: SettingsReader, writer: SettingsWriter): Promise<void> {
    this._read = reader;
    this._write = writer;
    await this._load();
  }

  // ── Public API ───────────────────────────────────────────────────────────

  getAll(): Role[] {
    return [...this._roles];
  }

  getByGroupId(groupId: string | null): Role[] {
    return this._roles.filter((r) => r.groupId === groupId);
  }

  findById(id: string): Role | undefined {
    return this._roles.find((r) => r.id === id);
  }

  async add(
    name: string,
    groupId: string | null,
    accessRange: AccessRange,
    privilege: RolePrivilege,
  ): Promise<Role> {
    const role = Role.create(name, groupId, accessRange, privilege);
    this._roles = [...this._roles, role];
    await this._save();
    return role;
  }

  async update(
    id: string,
    updates: Partial<Pick<RoleData, 'name' | 'accessRange' | 'privilege' | 'groupId'>>,
  ): Promise<Role | undefined> {
    const idx = this._roles.findIndex((r) => r.id === id);
    if (idx < 0) return undefined;
    const existing = this._roles[idx]!;
    const updated = new Role({
      ...existing.toJSON(),
      ...updates,
      updatedAt: Date.now(),
    });
    this._roles = [...this._roles.slice(0, idx), updated, ...this._roles.slice(idx + 1)];
    await this._save();
    return updated;
  }

  async remove(id: string): Promise<void> {
    this._roles = this._roles.filter((r) => r.id !== id);
    await this._save();
  }

  // ── Persistence ──────────────────────────────────────────────────────────

  private async _load(): Promise<void> {
    try {
      const raw = await this._read(STORAGE_KEY, '[]');
      const parsed: RoleData[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this._roles = parsed.map((d) => new Role(d));
      }
    } catch (e) {
      logger.warn('RoleRegistry: failed to load roles', e);
      this._roles = [];
    }
    this._loaded = true;
  }

  private async _save(): Promise<void> {
    try {
      await this._write(STORAGE_KEY, JSON.stringify(this._roles.map((r) => r.toJSON())));
    } catch (e) {
      logger.error('RoleRegistry: failed to save roles', e);
    }
  }
}

export const roleRegistry = new RoleRegistry();
