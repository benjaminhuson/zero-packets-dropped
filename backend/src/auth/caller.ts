// Section 5: works out who is calling.
//
// In Azure, App Service authentication (Easy Auth) handles the Microsoft sign-in for managers, buddies
// and linked colleagues. It validates the Entra token and passes the user on in X-MS-CLIENT-PRINCIPAL-*
// headers. App Service strips those headers from incoming requests, so they can be trusted, but ONLY
// when AUTH=easyauth and the app is reached through App Service.
//
// New colleagues without Entra ID sign in with Stride's own session cookie (see api/people.ts).
//
// Locally (AUTH=dev) there is no Easy Auth, so you can pretend:
//   x-user-id: <starter id>             act as that starter (the original dev header)
//   x-dev-entra-upn: priya@example.test  act as an Entra user (manager, buddy or linked colleague)
//   or the stride_dev_upn cookie, set by POST /api/dev/login (the browser stand-in for Microsoft sign-in)
import type { IncomingHttpHeaders } from 'node:http';
import type { Caller, Store } from '../contracts.js';
import { verifySession } from './crypto.js';

export const SESSION_COOKIE = 'stride_session';
export const DEV_UPN_COOKIE = 'stride_dev_upn';
export const SESSION_HOURS = 12;

export interface AuthSettings {
  mode: 'dev' | 'easyauth';
  sessionSecret: string;
}

function header(headers: IncomingHttpHeaders, name: string): string | null {
  const v = headers[name];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export function readCookie(headers: IncomingHttpHeaders, name: string): string | null {
  const raw = header(headers, 'cookie');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

interface EntraUser {
  upn: string;
  name: string;
}

// Easy Auth passes the user in X-MS-CLIENT-PRINCIPAL (base64 JSON claims) and X-MS-CLIENT-PRINCIPAL-NAME.
// Browser sign-in (ID token) and the Teams tab (access token from Teams SSO) can carry the UPN in different
// claims, so read the claims first and fall back to the name header.
const UPN_CLAIMS = ['preferred_username', 'upn', 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/upn', 'email'];

function entraUser(headers: IncomingHttpHeaders, settings: AuthSettings): EntraUser | null {
  if (settings.mode === 'dev') {
    const upn = header(headers, 'x-dev-entra-upn') ?? readCookie(headers, DEV_UPN_COOKIE);
    return upn ? { upn: upn.toLowerCase(), name: upn.split('@')[0] } : null;
  }
  let claims: { typ: string; val: string }[] = [];
  const principal = header(headers, 'x-ms-client-principal');
  if (principal) {
    try {
      claims = (JSON.parse(Buffer.from(principal, 'base64').toString('utf8')) as { claims?: { typ: string; val: string }[] }).claims ?? [];
    } catch {
      claims = [];
    }
  }
  const claim = (typ: string) => claims.find((c) => c.typ === typ)?.val;
  const fromClaims = UPN_CLAIMS.map(claim).find((v) => v && v.includes('@'));
  const upn = fromClaims ?? header(headers, 'x-ms-client-principal-name');
  if (!upn || !upn.includes('@')) return null;
  return { upn: upn.toLowerCase(), name: claim('name') ?? upn.split('@')[0] };
}

export async function resolveCaller(headers: IncomingHttpHeaders, store: Store, settings: AuthSettings, now: Date): Promise<Caller | null> {
  // 1. Microsoft (Entra) sign-in wins. A colleague whose UPN has been linked is still a starter.
  const entra = entraUser(headers, settings);
  if (entra) {
    const linked = await store.findStarterByUpn(entra.upn);
    if (linked) {
      if (!linked.entraLinkedAt) await store.saveStarter({ ...linked, entraLinkedAt: now.toISOString() });
      return { kind: 'starter', userId: linked.id, name: linked.firstName, via: 'entra' };
    }
    return { kind: 'staff', upn: entra.upn, name: entra.name };
  }

  // 2. Stride session cookie (new colleague, before Entra).
  const token = readCookie(headers, SESSION_COOKIE);
  if (token) {
    const payload = verifySession(token, settings.sessionSecret, Math.floor(now.getTime() / 1000));
    if (payload) {
      const account = await store.getStarter(payload.sub);
      // Once the colleague has signed in with Entra, their Stride password no longer works.
      if (account && !account.entraLinkedAt) return { kind: 'starter', userId: account.id, name: account.firstName, via: 'stride' };
    }
  }

  // 3. Dev only: the original x-user-id header.
  if (settings.mode === 'dev') {
    const userId = header(headers, 'x-user-id');
    if (userId) return { kind: 'starter', userId, name: userId, via: 'stride' };
  }
  return null;
}
