export const SYSTEM_SPACE_ID = 'system';

export type SpaceType = 'system' | 'custom';

/** One switchable data context (folder + isolated settings). */
export interface SpaceEntry {
  id: string;
  name: string;
  type: SpaceType;
  /** Absolute data root — only for custom spaces. */
  dataPath?: string;
  createdAt: string;
}

export interface SpaceRegistry {
  activeSpaceId: string;
  spaces: SpaceEntry[];
}

export interface SpaceRegistrySnapshot {
  registry: SpaceRegistry;
  defaultUserDataPath: string;
  activeDataPath: string;
}

export function createSystemSpaceEntry(): SpaceEntry {
  return {
    id: SYSTEM_SPACE_ID,
    name: 'System User',
    type: 'system',
    createdAt: '1970-01-01T00:00:00.000Z',
  };
}

export function createDefaultSpaceRegistry(): SpaceRegistry {
  return {
    activeSpaceId: SYSTEM_SPACE_ID,
    spaces: [createSystemSpaceEntry()],
  };
}

export function isSystemSpace(space: SpaceEntry): boolean {
  return space.type === 'system' || space.id === SYSTEM_SPACE_ID;
}
