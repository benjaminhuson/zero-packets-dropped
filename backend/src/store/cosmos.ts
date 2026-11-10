// Section 2 (Azure): Cosmos DB store.
// Keyless: signs in with DefaultAzureCredential (the App Service managed identity in Azure, or your
// `az login` locally). The account has key auth turned off, so there is no connection string anywhere.
// Containers and partition keys are created by infra/main.bicep; see CONTAINERS below.
import { CosmosClient, type Container, type SqlQuerySpec } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import type { ChatTurn, CheckInRequest, Journey, Note, StarterAccount, StarterState, Store, TeamsContact, TeamsMessage, UserId } from '../contracts.js';

// Container name -> partition key path. Keep in step with infra/main.bicep.
export const CONTAINERS = {
  journeys: '/userId',
  messages: '/userId',
  checkIns: '/userId',
  chat: '/userId',
  starters: '/id',
  starterState: '/userId',
  notes: '/starterId',
  teamsContacts: '/upn',
} as const;

type Name = keyof typeof CONTAINERS;

// Drop Cosmos system fields (_rid, _etag, ...) so documents match the contracts exactly.
function clean<T>(doc: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(doc)) if (!k.startsWith('_')) out[k] = v;
  return out as T;
}

export class CosmosStore implements Store {
  private readonly c: Record<Name, Container>;

  constructor(endpoint: string, databaseName: string) {
    if (!endpoint) throw new Error('STORE=cosmos needs AZURE_COSMOS_ENDPOINT');
    const client = new CosmosClient({ endpoint, aadCredentials: new DefaultAzureCredential() });
    const db = client.database(databaseName);
    this.c = Object.fromEntries(Object.keys(CONTAINERS).map((n) => [n, db.container(n)])) as Record<Name, Container>;
  }

  private async query<T>(name: Name, spec: SqlQuerySpec, partitionKey?: string): Promise<T[]> {
    const { resources } = await this.c[name].items.query<Record<string, unknown>>(spec, partitionKey ? { partitionKey } : {}).fetchAll();
    return resources.map((r) => clean<T>(r));
  }

  private async read<T>(name: Name, id: string, partitionKey: string): Promise<T | null> {
    try {
      const { resource } = await this.c[name].item(id, partitionKey).read<Record<string, unknown>>();
      return resource ? clean<T>(resource) : null;
    } catch (err) {
      if ((err as { code?: number }).code === 404) return null;
      throw err;
    }
  }

  private async first<T>(name: Name, where: string, value: string): Promise<T | null> {
    const rows = await this.query<T>(name, { query: `SELECT TOP 1 * FROM c WHERE ${where}`, parameters: [{ name: '@v', value }] });
    return rows[0] ?? null;
  }

  // ---- Journeys and activity (partition = userId) -----------------------------

  getJourney(userId: UserId) {
    return this.read<Journey>('journeys', userId, userId);
  }
  async saveJourney(journey: Journey) {
    await this.c.journeys.items.upsert({ id: journey.userId, ...journey });
  }
  async listUserIds() {
    const rows = await this.query<{ userId: string }>('journeys', { query: 'SELECT c.userId FROM c' });
    return rows.map((r) => r.userId);
  }
  async appendMessage(message: TeamsMessage) {
    await this.c.messages.items.create(message);
  }
  listMessages(userId: UserId) {
    return this.query<TeamsMessage>('messages', { query: 'SELECT * FROM c ORDER BY c.sentAt DESC' }, userId);
  }
  async addCheckIn(checkIn: CheckInRequest) {
    await this.c.checkIns.items.create(checkIn);
  }
  listCheckIns(userId: UserId) {
    // Check-ins have no timestamp; ids are random, so newest-first relies on _ts.
    return this.query<CheckInRequest>('checkIns', { query: 'SELECT * FROM c ORDER BY c._ts DESC' }, userId);
  }
  async appendChat(turn: ChatTurn) {
    await this.c.chat.items.create(turn);
  }
  listChat(userId: UserId) {
    return this.query<ChatTurn>('chat', { query: 'SELECT * FROM c ORDER BY c.sentAt ASC' }, userId);
  }

  // ---- People (partition = id; lookups are small cross-partition queries) --------

  getStarter(id: UserId) {
    return this.read<StarterAccount>('starters', id, id);
  }
  async saveStarter(account: StarterAccount) {
    await this.c.starters.items.upsert(account);
  }
  findStarterByEmail(email: string) {
    return this.first<StarterAccount>('starters', 'c.email = @v', email);
  }
  findStarterByUpn(upn: string) {
    return this.first<StarterAccount>('starters', 'c.upn = @v', upn);
  }
  findStarterByInvite(inviteHash: string) {
    return this.first<StarterAccount>('starters', 'c.inviteHash = @v', inviteHash);
  }
  listStartersForStaff(upn: string) {
    return this.query<StarterAccount>('starters', {
      query: 'SELECT * FROM c WHERE c.managerUpn = @v OR c.buddyUpn = @v',
      parameters: [{ name: '@v', value: upn }],
    });
  }

  // ---- Saved app state and the shared thread ----------------------------------------

  getStarterState(userId: UserId) {
    return this.read<StarterState>('starterState', userId, userId);
  }
  async saveStarterState(state: StarterState) {
    await this.c.starterState.items.upsert({ id: state.userId, ...state });
  }
  async appendNote(note: Note) {
    await this.c.notes.items.create(note);
  }
  listNotes(starterId: UserId) {
    return this.query<Note>('notes', { query: 'SELECT * FROM c ORDER BY c.sentAt ASC' }, starterId);
  }

  // ---- Teams contacts (partition = upn) ------------------------------------------------

  getTeamsContact(upn: string) {
    return this.read<TeamsContact>('teamsContacts', upn, upn);
  }
  async saveTeamsContact(contact: TeamsContact) {
    await this.c.teamsContacts.items.upsert({ id: contact.upn, ...contact });
  }
}
