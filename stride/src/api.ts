// Calls to the Stride API. Same origin in Azure (App Service serves both), proxied by Vite locally.

export type Me =
  | { kind: 'starter'; id: string; name: string; via: 'stride' | 'entra'; entraLinkPending: boolean }
  | { kind: 'staff'; name: string; upn: string; starters: StarterCard[] };

export interface StarterSummary {
  stage: number;
  stageName: string;
  stagesTotal: number;
  stepsDone: number;
  startDate: string | null;
}

export interface StarterCard {
  id: string;
  name: string;
  relationship: 'manager' | 'buddy';
  invitePending: boolean;
  upn: string | null;
  entraLinked: boolean;
  summary: StarterSummary | null;
}

export interface Note {
  id: string;
  starterId: string;
  from: 'starter' | 'manager' | 'buddy';
  fromName: string;
  text: string;
  sentAt: string;
}

export interface StarterView extends StarterCard {
  notes: Note[];
  email?: string;
  buddyUpn?: string | null;
  inviteExpiresAt?: string | null;
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string } | null)?.error ?? `Request failed (${res.status})`);
  return data as T;
}

// Microsoft sign-in is handled by App Service authentication, outside the API.
export const MICROSOFT_LOGIN = '/.auth/login/aad?post_login_redirect_uri=/';
export const MICROSOFT_LOGOUT = '/.auth/logout?post_logout_redirect_uri=/';

export const api = {
  // 'offline' means there is no Stride API (e.g. `npm run dev` without the backend): run the prototype.
  async me(): Promise<Me | 'signed-out' | 'offline'> {
    try {
      return await call<Me>('GET', '/api/me');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return 'signed-out';
      return 'offline';
    }
  },
  login: (email: string, password: string) => call<{ ok: true }>('POST', '/api/auth/login', { email, password }),
  redeemInvite: (code: string, password: string) => call<{ ok: true; email: string }>('POST', '/api/auth/invite', { code, password }),
  logout: () => call<{ ok: true }>('POST', '/api/auth/logout', {}),

  loadState: <T>() => call<{ state: T } | null>('GET', '/api/state'),
  saveState: (state: unknown, summary: StarterSummary) => call('PUT', '/api/state', { state, summary }),
  notes: () => call<Note[]>('GET', '/api/notes'),
  postNote: (text: string) => call<Note>('POST', '/api/notes', { text }),

  starters: () => call<StarterCard[]>('GET', '/api/starters'),
  starter: (id: string) => call<StarterView>('GET', `/api/starters/${encodeURIComponent(id)}`),
  createStarter: (input: { firstName: string; lastName: string; email: string; buddyUpn: string }) =>
    call<{ starter: StarterCard; inviteCode: string; inviteExpiresAt: string }>('POST', '/api/starters', input),
  reissueInvite: (id: string) => call<{ inviteCode: string; inviteExpiresAt: string }>('POST', `/api/starters/${encodeURIComponent(id)}/invite`, {}),
  setBuddy: (id: string, buddyUpn: string) => call<StarterCard>('POST', `/api/starters/${encodeURIComponent(id)}/buddy`, { buddyUpn }),
  linkEntra: (id: string, upn: string) => call<StarterCard>('POST', `/api/starters/${encodeURIComponent(id)}/link`, { upn }),
  postStaffNote: (id: string, text: string) => call<Note>('POST', `/api/starters/${encodeURIComponent(id)}/notes`, { text }),
};
