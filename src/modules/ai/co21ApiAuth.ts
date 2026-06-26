import { loadCo21Settings, patchCo21Settings } from 'src/modules/storage/sync/roleProfileSettings';
import { deviceId } from 'src/modules/storage/sync/deviceId';
import { co21ApiRequest } from './co21ApiClient';

const TOKEN_KEY = 'co21ApiToken';

type AuthOut = {
  token?: string;
};

export async function loadCo21ApiToken(): Promise<string> {
  const data = await loadCo21Settings();
  const raw = typeof data[TOKEN_KEY] === 'string' ? data[TOKEN_KEY].trim() : '';
  return raw;
}

export async function saveCo21ApiToken(token: string): Promise<void> {
  await patchCo21Settings({ [TOKEN_KEY]: token.trim() });
}

export async function ensureCo21ApiToken(): Promise<string | null> {
  const existing = await loadCo21ApiToken();
  if (existing) return existing;

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
  if (!res.ok || !token) return null;

  await saveCo21ApiToken(token);
  return token;
}

export async function co21AuthHeaders(): Promise<Record<string, string>> {
  const token = await ensureCo21ApiToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
