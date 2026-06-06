/** SHA-256 hex digest for password storage (renderer + main use same algorithm). */
export async function hashPasswordSha256(plain: string): Promise<string> {
  try {
    const encoded = new TextEncoder().encode(plain);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return btoa(plain);
  }
}

export async function verifyPasswordSha256(plain: string, storedHash: string): Promise<boolean> {
  if (!plain || !storedHash) return false;
  const hash = await hashPasswordSha256(plain);
  return hash === storedHash;
}
