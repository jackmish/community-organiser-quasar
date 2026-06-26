import { loadCo21Settings, patchCo21Settings } from 'src/modules/storage/sync/roleProfileSettings';
import { deviceId } from 'src/modules/storage/sync/deviceId';
import { co21ApiRequest } from './co21ApiClient';

const TOKEN_KEY = 'co21ApiToken';

type AuthOut = {
  token?: string;
};

export type Co21ApiAuthResult = {
  token: string | null;
  error: string;
};

function parseApiError(rawBody: string, status: number, fallback: string): string {
  if (status === 0) return 'CO21 backend server is not reachable';
  if (status === 401 || status === 403) return 'CO21 backend rejected authentication';
  if (rawBody) {
    try {
      const parsed = JSON.parse(rawBody) as { detail?: unknown; message?: string };
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return parsed.message.trim();
      }
      if (typeof parsed.detail === 'string' && parsed.detail.trim()) {
        return parsed.detail.trim();
      }
    } catch {
      /* ignore */
    }
  }
  return fallback;
}

export async function loadCo21ApiToken(): Promise<string> {
  const data = await loadCo21Settings();
  const raw = typeof data[TOKEN_KEY] === 'string' ? data[TOKEN_KEY].trim() : '';
  return raw;
}

export async function saveCo21ApiToken(token: string): Promise<void> {
  await patchCo21Settings({ [TOKEN_KEY]: token.trim() });
}

export async function clearCo21ApiToken(): Promise<void> {
  await patchCo21Settings({ [TOKEN_KEY]: '' });
}

export async function ensureCo21ApiToken(): Promise<string | null> {
  const result = await requestCo21ApiToken();
  return result.token;
}

export async function requestCo21ApiToken(force = false): Promise<Co21ApiAuthResult> {
  if (!force) {
    const existing = await loadCo21ApiToken();
    if (existing) return { token: existing, error: '' };
  } else {
    await clearCo21ApiToken();
  }

  const id = await deviceId.get();
  const res = await co21ApiRequest<AuthOut>({
    path: '/api/v1/auth/device',
    method: 'POST',
    body: {
      device_id: id,
      device_name: 'CO21 desktop',
    },
    timeoutMs: 15_000,
  });

  const token = typeof res.data?.token === 'string' ? res.data.token.trim() : '';
  if (!res.ok || !token) {
    return {
      token: null,
      error: parseApiError(res.rawBody, res.status, 'Could not authenticate with CO21 backend server'),
    };
  }

  await saveCo21ApiToken(token);
  return { token, error: '' };
}

export async function co21AuthHeaders(): Promise<Record<string, string>> {
  const token = await ensureCo21ApiToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
