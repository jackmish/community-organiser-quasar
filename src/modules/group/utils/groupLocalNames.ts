const LOCAL_GROUP_NAMES_KEY = 'co21:group-local-names:v1';

type LocalNamesMap = Record<string, string>;

function readMap(): LocalNamesMap {
  try {
    const raw = localStorage.getItem(LOCAL_GROUP_NAMES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: LocalNamesMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const id = String(k || '').trim();
      const name = typeof v === 'string' ? v.trim() : '';
      if (id && name) out[id] = name;
    }
    return out;
  } catch {
    return {};
  }
}

function writeMap(map: LocalNamesMap): void {
  try {
    localStorage.setItem(LOCAL_GROUP_NAMES_KEY, JSON.stringify(map));
  } catch {
    void 0;
  }
}

export function getLocalGroupName(groupId: string | null | undefined): string {
  const id = String(groupId ?? '').trim();
  if (!id) return '';
  const map = readMap();
  return map[id] || '';
}

export function setLocalGroupName(groupId: string, localName: string): void {
  const id = String(groupId || '').trim();
  if (!id) return;
  const map = readMap();
  const trimmed = String(localName || '').trim();
  if (!trimmed) delete map[id];
  else map[id] = trimmed;
  writeMap(map);
}

export function resolveLocalGroupName(group: { id?: string; name?: string } | null | undefined): string {
  if (!group) return '';
  const id = String(group.id ?? '').trim();
  if (!id) return String(group.name || '');
  const local = getLocalGroupName(id);
  return local || String(group.name || '');
}
