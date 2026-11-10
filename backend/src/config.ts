// Reads settings from the environment. Nothing secret is hard-coded.
import { randomBytes } from 'node:crypto';

export interface Config {
  port: number;
  store: 'memory' | 'cosmos';
  agent: 'rules' | 'ai';
  teams: 'mock' | 'graph';
  auth: 'dev' | 'easyauth';
  cosmosEndpoint: string;
  cosmosDatabase: string;
  adminToken: string | null;
  sessionSecret: string;
  staticDir: string | null; // built front end to serve (stride/dist), if any
  scheduler: boolean; // run the daily catch-up in-process
  appUrl: string; // public https URL of this app (used in Teams buttons and the Teams app package)
  teamNumber: string;
  // Teams (TEAMS=graph)
  botAppId: string; // the bot's app id = client id of its user-assigned managed identity
  tenantId: string;
  entraClientId: string; // the teamNN-stride app registration (Microsoft sign-in, Teams tab SSO, Graph)
  meetings: 'link' | 'graph';
}

function oneOf<T extends string>(name: string, value: string, allowed: readonly T[]): T {
  if (!(allowed as readonly string[]).includes(value)) throw new Error(`${name} must be ${allowed.join(' or ')}, got ${value}`);
  return value as T;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const auth = oneOf('AUTH', env.AUTH ?? 'dev', ['dev', 'easyauth'] as const);
  // Dev auth trusts made-up headers. Refuse to start like that inside App Service.
  if (auth === 'dev' && env.WEBSITE_SITE_NAME) throw new Error('AUTH=dev is not allowed on App Service. Set AUTH=easyauth.');
  let sessionSecret = env.SESSION_SECRET ?? '';
  if (!sessionSecret) {
    if (auth === 'easyauth') throw new Error('SESSION_SECRET is required when AUTH=easyauth');
    sessionSecret = randomBytes(32).toString('base64url'); // dev: sessions end when the process restarts
  }
  const port = Number(env.PORT ?? 3001);
  const teams = oneOf('TEAMS', env.TEAMS ?? 'mock', ['mock', 'graph'] as const);
  const botAppId = env.BOT_APP_ID ?? '';
  const tenantId = env.ENTRA_TENANT_ID ?? '';
  if (teams === 'graph' && (!botAppId || !tenantId)) throw new Error('TEAMS=graph needs BOT_APP_ID and ENTRA_TENANT_ID');
  return {
    port,
    store: oneOf('STORE', env.STORE ?? 'memory', ['memory', 'cosmos'] as const),
    agent: oneOf('AGENT', env.AGENT ?? 'rules', ['rules', 'ai'] as const),
    teams,
    auth,
    cosmosEndpoint: env.AZURE_COSMOS_ENDPOINT ?? '',
    cosmosDatabase: env.AZURE_COSMOS_DATABASE ?? 'stride',
    adminToken: env.ADMIN_TOKEN || null,
    sessionSecret,
    staticDir: env.STATIC_DIR || null,
    scheduler: env.SCHEDULER === 'on',
    // App Service sets WEBSITE_HOSTNAME to the app's own host name.
    appUrl: (env.PUBLIC_URL || (env.WEBSITE_HOSTNAME ? `https://${env.WEBSITE_HOSTNAME}` : `http://localhost:${port}`)).replace(/\/$/, ''),
    teamNumber: env.TEAM_NUMBER ?? 'NN',
    botAppId,
    tenantId,
    entraClientId: env.ENTRA_CLIENT_ID ?? '',
    meetings: oneOf('MEETINGS', env.MEETINGS ?? 'link', ['link', 'graph'] as const),
  };
}
