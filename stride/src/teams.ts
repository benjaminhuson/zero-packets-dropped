// Running inside Microsoft Teams (the Stride personal tab). Teams opens Stride with ?inTeams=1 (see the Teams app
// manifest). There, sign-in is silent: Teams gives us a token for the signed-in user (Teams SSO), which we send to
// the API as a bearer token. App Service authentication checks it, exactly like a browser sign-in.
// The Teams library is only loaded inside Teams, so the normal web app stays small.

const FLAG = 'stride-in-teams';

export function inTeams(): boolean {
  try {
    if (new URLSearchParams(window.location.search).get('inTeams') === '1') sessionStorage.setItem(FLAG, '1');
    return sessionStorage.getItem(FLAG) === '1';
  } catch {
    return new URLSearchParams(window.location.search).get('inTeams') === '1';
  }
}

type TeamsLib = typeof import('@microsoft/teams-js');
let lib: Promise<TeamsLib> | null = null;

async function teams(): Promise<TeamsLib> {
  if (!lib) {
    lib = import('@microsoft/teams-js').then(async (t) => {
      // Outside Teams (someone opened the ?inTeams=1 link in a browser) initialize() never finishes.
      await Promise.race([
        t.app.initialize(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Teams did not respond. Is Stride open inside Teams?')), 8000)),
      ]);
      return t;
    });
    lib.catch(() => { lib = null; });
  }
  return lib;
}

// A fresh token each time; Teams caches and renews it.
export async function teamsToken(): Promise<string> {
  const t = await teams();
  return t.authentication.getAuthToken();
}

export async function notifyTeamsReady(): Promise<void> {
  const t = await teams();
  t.app.notifySuccess();
}
