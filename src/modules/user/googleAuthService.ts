/**
 * Renderer-side Google auth service.
 *
 * Talks to the main process via `window.electronGoogleAuth` (preload bridge)
 * and persists tokens through the app settings backend.
 */
import {
  getSetting,
  setSetting,
} from 'src/modules/storage/backend/electron/electronBackend';
import logger from 'src/utils/logger';

const TOKEN_KEY = 'co21_google_tokens';

interface StoredTokens {
  access_token: string;
  refresh_token?: string | undefined;
  expires_at: number;
}

interface ElectronGoogleAuth {
  startAuth(): Promise<{
    ok: boolean;
    tokens?: {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
    };
    user?: { email: string; name: string; picture: string | null };
    error?: string;
  }>;
  refreshToken(refreshToken: string): Promise<{
    ok: boolean;
    tokens?: {
      access_token: string;
      expires_in: number;
    };
    error?: string;
  }>;
}

function bridge(): ElectronGoogleAuth | null {
  return (window as any).electronGoogleAuth ?? null;
}

/**
 * Kick off the Google OAuth loopback flow.
 * Returns the user profile on success, or throws.
 */
export async function signInWithGoogle(): Promise<{
  email: string;
  displayName: string;
  avatarUrl: string | null;
}> {
  const api = bridge();
  if (!api) throw new Error('Google auth bridge not available (not running in Electron)');

  const result = await api.startAuth();
  if (!result.ok || !result.tokens || !result.user) {
    throw new Error(result.error || 'Google sign-in failed');
  }

  await saveTokens({
    access_token: result.tokens.access_token,
    refresh_token: result.tokens.refresh_token,
    expires_at: Date.now() + (result.tokens.expires_in - 60) * 1000,
  });

  return {
    email: result.user.email,
    displayName: result.user.name,
    avatarUrl: result.user.picture ?? null,
  };
}

/**
 * Get a valid access token (refreshing if needed).
 */
export async function getAccessToken(): Promise<string | null> {
  const stored = await loadTokens();
  if (!stored) return null;

  if (Date.now() < stored.expires_at) {
    return stored.access_token;
  }

  if (!stored.refresh_token) return null;

  const api = bridge();
  if (!api) return null;

  try {
    const result = await api.refreshToken(stored.refresh_token);
    if (!result.ok || !result.tokens) {
      logger.warn('[GoogleAuth] Token refresh failed:', result.error);
      return null;
    }

    await saveTokens({
      access_token: result.tokens.access_token,
      refresh_token: stored.refresh_token,
      expires_at: Date.now() + (result.tokens.expires_in - 60) * 1000,
    });

    return result.tokens.access_token;
  } catch (e) {
    logger.warn('[GoogleAuth] Token refresh error', e);
    return null;
  }
}

/**
 * Remove stored tokens (sign out).
 */
export async function clearGoogleTokens(): Promise<void> {
  await setSetting(TOKEN_KEY, null);
}

async function saveTokens(tokens: StoredTokens): Promise<void> {
  await setSetting(TOKEN_KEY, tokens);
}

async function loadTokens(): Promise<StoredTokens | null> {
  try {
    const raw = await getSetting(TOKEN_KEY, null);
    if (raw && typeof raw === 'object' && raw.access_token) {
      return raw as StoredTokens;
    }
    return null;
  } catch {
    return null;
  }
}
