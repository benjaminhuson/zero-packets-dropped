// Reads settings from the environment. Nothing secret is hard-coded.
export interface Config {
  port: number;
  store: 'memory' | 'cosmos';
  agent: 'rules' | 'ai';
  teams: 'mock' | 'graph';
  cosmosEndpoint: string;
  adminToken: string | null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const store = env.STORE ?? 'memory';
  const agent = env.AGENT ?? 'rules';
  const teams = env.TEAMS ?? 'mock';
  if (store !== 'memory' && store !== 'cosmos') throw new Error(`STORE must be memory or cosmos, got ${store}`);
  if (agent !== 'rules' && agent !== 'ai') throw new Error(`AGENT must be rules or ai, got ${agent}`);
  if (teams !== 'mock' && teams !== 'graph') throw new Error(`TEAMS must be mock or graph, got ${teams}`);
  return {
    port: Number(env.PORT ?? 3001),
    store,
    agent,
    teams,
    cosmosEndpoint: env.AZURE_COSMOS_ENDPOINT ?? '',
    adminToken: env.ADMIN_TOKEN ?? null,
  };
}
