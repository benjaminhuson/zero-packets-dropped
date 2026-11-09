// Entry point: wires the sections together and starts the HTTP server.
import { createServer } from 'node:http';
import { loadConfig } from './config.js';
import { JourneyService, HttpError } from './api/service.js';
import { buildRoutes, readBody } from './api/routes.js';
import { MemoryStore } from './store/memory.js';
import { CosmosStore } from './store/cosmos.js';
import { MockTeamsGateway } from './teams/mock.js';
import { GraphTeamsGateway } from './teams/graph.js';
import { RulesAgent } from './agent/rules.js';
import { AiAgent } from './agent/ai.js';
import type { Clock, Store, TeamsGateway, AgentGateway } from './contracts.js';

const config = loadConfig();

const store: Store = config.store === 'memory' ? new MemoryStore() : new CosmosStore(config.cosmosEndpoint);
const teams: TeamsGateway = config.teams === 'mock' ? new MockTeamsGateway() : new GraphTeamsGateway();
const agent: AgentGateway = config.agent === 'rules' ? new RulesAgent() : new AiAgent();
const clock: Clock = { now: () => new Date() };

const service = new JourneyService(store, teams, agent, clock);
const routes = buildRoutes({ service, store, adminToken: config.adminToken });

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  };
  try {
    const match = routes
      .map((route) => ({ route, m: url.pathname.match(route.pattern) }))
      .find((x) => x.m && x.route.method === req.method);
    if (!match || !match.m) {
      const pathExists = routes.some((rt) => rt.pattern.test(url.pathname));
      return send(pathExists ? 405 : 404, { error: pathExists ? 'Method not allowed' : 'Not found' });
    }
    const params = Object.fromEntries(match.route.names.map((n, i) => [n, decodeURIComponent(match.m![i + 1])]));
    const body = await readBody(req);
    const header = (name: string) => {
      const v = req.headers[name];
      return typeof v === 'string' ? v : null;
    };
    const result = await match.route.handler({
      method: req.method ?? 'GET',
      path: url.pathname,
      params,
      body,
      userId: header('x-user-id'),
      adminToken: header('x-admin-token'),
    });
    send(result.status, result.body);
  } catch (err) {
    if (err instanceof HttpError) return send(err.status, { error: err.message });
    console.error(err);
    send(500, { error: 'Something went wrong' });
  }
});

server.listen(config.port, () => {
  console.log(`stride-backend listening on http://localhost:${config.port} (store=${config.store}, agent=${config.agent}, teams=${config.teams})`);
});
