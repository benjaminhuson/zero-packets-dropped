// Entry point: wires the sections together and starts the HTTP server.
import { createServer } from 'node:http';
import { loadConfig } from './config.js';
import { JourneyService, HttpError } from './api/service.js';
import { PeopleService } from './api/people.js';
import { buildRoutes, readBody } from './api/routes.js';
import { resolveCaller } from './auth/caller.js';
import { serveStatic } from './static.js';
import { runCatchUp } from './scheduler/reminders.js';
import { MemoryStore } from './store/memory.js';
import { CosmosStore } from './store/cosmos.js';
import { MockTeamsGateway } from './teams/mock.js';
import { GraphTeamsGateway } from './teams/graph.js';
import { RulesAgent } from './agent/rules.js';
import { AiAgent } from './agent/ai.js';
import type { Clock, Store, TeamsGateway, AgentGateway } from './contracts.js';

const config = loadConfig();

const store: Store = config.store === 'memory' ? new MemoryStore() : new CosmosStore(config.cosmosEndpoint, config.cosmosDatabase);
const teams: TeamsGateway = config.teams === 'mock' ? new MockTeamsGateway() : new GraphTeamsGateway();
const agent: AgentGateway = config.agent === 'rules' ? new RulesAgent() : new AiAgent();
const clock: Clock = { now: () => new Date() };

const service = new JourneyService(store, teams, agent, clock);
const people = new PeopleService(store, clock);
const routes = buildRoutes({
  service,
  people,
  store,
  clock,
  adminToken: config.adminToken,
  sessionSecret: config.sessionSecret,
  secureCookies: config.auth === 'easyauth',
  devAuth: config.auth === 'dev',
});
const authSettings = { mode: config.auth, sessionSecret: config.sessionSecret };

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'x-frame-options': 'DENY',
};

const server = createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  const url = new URL(req.url ?? '/', 'http://localhost');
  const send = (status: number, body: unknown, headers: Record<string, string | string[]> = {}) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
    res.end(JSON.stringify(body));
  };
  try {
    if (!url.pathname.startsWith('/api/')) {
      if (config.staticDir && (req.method === 'GET' || req.method === 'HEAD')) return await serveStatic(config.staticDir, url.pathname, res);
      return send(404, { error: 'Not found' });
    }
    const match = routes
      .map((route) => ({ route, m: url.pathname.match(route.pattern) }))
      .find((x) => x.m && x.route.method === req.method);
    if (!match || !match.m) {
      const pathExists = routes.some((rt) => rt.pattern.test(url.pathname));
      return send(pathExists ? 405 : 404, { error: pathExists ? 'Method not allowed' : 'Not found' });
    }
    // Cross-site forms cannot send application/json without a CORS preflight, which we never allow.
    // Requiring it on every write stops cross-site request forgery against the session cookies.
    if (req.method !== 'GET' && req.method !== 'HEAD' && !(req.headers['content-type'] ?? '').startsWith('application/json')) {
      return send(415, { error: 'Send JSON (content-type: application/json)' });
    }
    const params = Object.fromEntries(match.route.names.map((n, i) => [n, decodeURIComponent(match.m![i + 1])]));
    const body = await readBody(req);
    const header = (name: string) => {
      const v = req.headers[name];
      return typeof v === 'string' ? v : null;
    };
    const caller = await resolveCaller(req.headers, store, authSettings, clock.now());
    const result = await match.route.handler({
      method: req.method ?? 'GET',
      path: url.pathname,
      params,
      body,
      caller,
      adminToken: header('x-admin-token'),
    });
    send(result.status, result.body, result.headers);
  } catch (err) {
    if (err instanceof HttpError) return send(err.status, { error: err.message });
    console.error(err);
    send(500, { error: 'Something went wrong' });
  }
});

// Daily catch-up (weekly reminders, overdue nudges). In-process is enough for the PoC: the App Service
// has Always On, and the job is idempotent, so a restart or a second instance does no harm.
if (config.scheduler) {
  const run = () => runCatchUp(store, service).then((r) => console.log(`catch-up: ${r.users} users, ${r.sent} messages`)).catch(console.error);
  setTimeout(run, 60_000);
  setInterval(run, 24 * 3600_000);
}

server.listen(config.port, () => {
  console.log(`stride-backend listening on port ${config.port} (store=${config.store}, auth=${config.auth}, agent=${config.agent}, teams=${config.teams})`);
});
