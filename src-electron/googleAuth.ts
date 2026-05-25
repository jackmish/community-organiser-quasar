/**
 * Google OAuth 2.0 for Desktop Apps — loopback redirect flow.
 *
 * 1. Spins up a one-shot HTTP server on 127.0.0.1 (random port)
 * 2. Opens system browser to Google consent screen
 * 3. Catches the redirect with the auth code
 * 4. Exchanges the code for access + refresh tokens
 * 5. Fetches the user profile (email, name, avatar)
 * 6. Returns everything to the renderer via IPC
 */
import http from 'http';
import { shell } from 'electron';
import { URL, URLSearchParams } from 'url';
import logger from 'src/utils/logger';

// ── Configuration ──────────────────────────────────────────────────────────
// Replace these with your own Google Cloud Console OAuth 2.0 credentials.
// Create them at https://console.cloud.google.com/apis/credentials
// Application type: "Desktop app"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

const SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ');

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  id_token?: string;
  scope: string;
}

export interface GoogleUserInfo {
  email: string;
  name: string;
  picture: string | null;
}

export interface GoogleAuthResult {
  tokens: GoogleTokens;
  user: GoogleUserInfo;
}

/**
 * Start the full OAuth flow.
 * Returns a promise that resolves when the user completes consent
 * or rejects if cancelled / errored.
 */
export function startGoogleAuthFlow(): Promise<GoogleAuthResult> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error('Google sign-in timed out (5 min). Please try again.'));
      }
    }, 5 * 60 * 1000);

    function cleanup() {
      clearTimeout(timeout);
      try {
        server.close();
      } catch {
        void 0;
      }
    }

    server.on('request', (req, res) => {
      void (async () => {
      if (settled) {
        res.writeHead(200);
        res.end('Already handled.');
        return;
      }

      try {
        const url = new URL(req.url || '/', `http://127.0.0.1`);

        if (url.pathname !== '/callback') {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        const code = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error || !code) {
          settled = true;
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(buildHtmlPage('Sign-in cancelled', 'You can close this tab and return to CO21.'));
          cleanup();
          reject(new Error(error || 'No authorization code received'));
          return;
        }

        const port = (server.address() as { port: number }).port;
        const redirectUri = `http://127.0.0.1:${port}/callback`;

        const tokens = await exchangeCodeForTokens(code, redirectUri);
        const user = await fetchUserInfo(tokens.access_token);

        settled = true;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          buildHtmlPage(
            'Signed in!',
            `Welcome, ${user.name}. You can close this tab and return to CO21.`,
          ),
        );
        cleanup();
        resolve({ tokens, user });
      } catch (err) {
        settled = true;
        const error = err instanceof Error ? err : new Error(String(err));
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(buildHtmlPage('Error', error.message));
        cleanup();
        reject(error);
      }
      })();
    });

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      const redirectUri = `http://127.0.0.1:${port}/callback`;
      logger.debug(`[GoogleAuth] Loopback server listening on port ${port}`);

      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'consent',
      });

      const authUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
      shell.openExternal(authUrl).catch((err) => {
        settled = true;
        cleanup();
        reject(new Error(`Failed to open browser: ${err}`));
      });
    });

    server.on('error', (err) => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(err);
      }
    });
  });
}

/**
 * Exchange an authorization code for tokens.
 */
async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  return (await res.json()) as GoogleTokens;
}

/**
 * Refresh an access token using a refresh token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  return (await res.json()) as GoogleTokens;
}

/**
 * Fetch user profile info using an access token.
 */
async function fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch user info (${res.status})`);
  }

  const data = (await res.json()) as Record<string, unknown>;
  const email = typeof data.email === 'string' ? data.email : '';
  const name = typeof data.name === 'string' ? data.name : email;
  return {
    email,
    name,
    picture: typeof data.picture === 'string' ? data.picture : null,
  };
}

function buildHtmlPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>CO21 - ${title}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         display: flex; justify-content: center; align-items: center; height: 100vh;
         margin: 0; background: #f5f5f5; color: #333; }
  .card { background: #fff; padding: 48px 40px; border-radius: 12px;
          box-shadow: 0 2px 12px rgba(0,0,0,.1); text-align: center; max-width: 400px; }
  h1 { margin: 0 0 12px; font-size: 22px; }
  p  { margin: 0; color: #666; }
</style></head>
<body><div class="card"><h1>${title}</h1><p>${body}</p></div></body></html>`;
}
