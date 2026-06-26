import { hashPasswordSha256 } from 'src/utils/passwordHash';

/** Stable API-safe key (64 hex chars) for local annotation keys with long paths / NUL separators. */
export async function toRecognitionApiImageKey(localKey: string): Promise<string> {
  const trimmed = localKey.trim();
  if (!trimmed) return '';
  return hashPasswordSha256(trimmed);
}

export function parseFileImageKey(localKey: string): { root: string; path: string } | null {
  const prefix = 'file:';
  if (!localKey.startsWith(prefix)) return null;
  const rest = localKey.slice(prefix.length);
  const idx = rest.indexOf('\0');
  if (idx < 0) return null;
  const root = rest.slice(0, idx).trim();
  const filePath = rest.slice(idx + 1).trim();
  if (!root || !filePath) return null;
  return { root, path: filePath };
}
