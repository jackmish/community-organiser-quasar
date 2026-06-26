import { hashPasswordSha256 } from 'src/utils/passwordHash';

/** Stable API-safe key (64 hex chars) for local annotation keys with long paths / NUL separators. */
export async function toRecognitionApiImageKey(localKey: string): Promise<string> {
  const trimmed = localKey.trim();
  if (!trimmed) return '';
  return hashPasswordSha256(trimmed);
}
