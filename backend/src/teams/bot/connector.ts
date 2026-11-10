// Section 3: calls to the Bot Connector API (send messages, start one-to-one chats, read team members).
// Signs in as the bot with its user-assigned managed identity: no app secret.
import { ManagedIdentityCredential, type TokenCredential } from '@azure/identity';

export interface ChannelAccount {
  id: string; // "29:..."
  name?: string;
  aadObjectId?: string;
  userPrincipalName?: string;
  email?: string;
  tenantId?: string;
}

export interface Activity {
  type: string;
  id?: string;
  text?: string;
  serviceUrl?: string;
  channelId?: string;
  action?: string;
  from?: ChannelAccount;
  recipient?: ChannelAccount;
  conversation?: { id: string; conversationType?: string; tenantId?: string };
  membersAdded?: ChannelAccount[];
  channelData?: { tenant?: { id?: string }; team?: { id?: string; name?: string } };
  attachments?: { contentType: string; content: unknown }[];
}

// Only Microsoft's Bot Connector hosts may receive our bot token.
const ALLOWED_SERVICE_HOSTS = [/^smba\.trafficmanager\.net$/i, /(^|\.)botframework\.com$/i, /\.teams\.microsoft\.com$/i];

export function checkServiceUrl(serviceUrl: string): string {
  const url = new URL(serviceUrl);
  if (url.protocol !== 'https:' || !ALLOWED_SERVICE_HOSTS.some((r) => r.test(url.hostname))) {
    throw new Error(`untrusted serviceUrl host: ${url.hostname}`);
  }
  return url.toString().replace(/\/?$/, '/');
}

export class BotConnector {
  private readonly credential: TokenCredential;

  constructor(readonly appId: string, readonly tenantId: string, credential?: TokenCredential) {
    this.credential = credential ?? new ManagedIdentityCredential({ clientId: appId });
  }

  private async call<T>(serviceUrl: string, method: string, path: string, body?: unknown): Promise<T> {
    const token = await this.credential.getToken('https://api.botframework.com/.default');
    if (!token) throw new Error('could not get a Bot Framework token');
    const res = await fetch(new URL(path, checkServiceUrl(serviceUrl)), {
      method,
      headers: { authorization: `Bearer ${token.token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Bot Connector ${method} ${path} failed: ${res.status} ${await res.text().catch(() => '')}`);
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  send(serviceUrl: string, conversationId: string, activity: Partial<Activity>) {
    return this.call<{ id?: string }>(serviceUrl, 'POST', `v3/conversations/${encodeURIComponent(conversationId)}/activities`, { type: 'message', ...activity });
  }

  // Opens (or reopens) the one-to-one chat between the bot and a user. Works when the user has the
  // Stride app, or is a member of a team that has it.
  async createPersonalConversation(serviceUrl: string, tenantId: string, teamsUserId: string): Promise<string> {
    const res = await this.call<{ id: string }>(serviceUrl, 'POST', 'v3/conversations', {
      bot: { id: `28:${this.appId}` },
      members: [{ id: teamsUserId }],
      channelData: { tenant: { id: tenantId } },
      tenantId,
      isGroup: false,
    });
    return res.id;
  }

  getMember(serviceUrl: string, conversationId: string, memberId: string) {
    return this.call<ChannelAccount>(serviceUrl, 'GET', `v3/conversations/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(memberId)}`);
  }

  async listTeamMembers(serviceUrl: string, teamId: string): Promise<ChannelAccount[]> {
    const all: ChannelAccount[] = [];
    let token: string | undefined;
    do {
      const q = token ? `?continuationToken=${encodeURIComponent(token)}` : '';
      const page = await this.call<{ members: ChannelAccount[]; continuationToken?: string }>(
        serviceUrl, 'GET', `v3/conversations/${encodeURIComponent(teamId)}/pagedmembers${q}`,
      );
      all.push(...(page.members ?? []));
      token = page.continuationToken;
    } while (token && all.length < 2000);
    return all;
  }
}
