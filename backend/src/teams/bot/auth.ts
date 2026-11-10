// Section 3: checks that a request to /api/messages really comes from Teams (the Bot Connector).
// Teams signs every request with a JWT. We check the signature against Microsoft's published keys,
// the issuer, that the audience is our bot's app id, and that the token was issued for this serviceUrl.
// https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-authentication
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';

const BOT_FRAMEWORK_KEYS = createRemoteJWKSet(new URL('https://login.botframework.com/v1/.well-known/keys'));
const BOT_FRAMEWORK_ISSUER = 'https://api.botframework.com';

export interface BotAuthSettings {
  appId: string; // the bot's app id (the managed identity's client id)
  tenantId: string;
  keys?: { botFramework: JWTVerifyGetKey; entra: JWTVerifyGetKey }; // tests only
}

let entraKeys: ReturnType<typeof createRemoteJWKSet> | null = null;
let entraKeysTenant = '';

// Returns normally when the request is genuine; throws otherwise.
export async function verifyBotRequest(authorization: string | null, serviceUrl: unknown, settings: BotAuthSettings): Promise<JWTPayload> {
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new Error('missing bearer token');

  let payload: JWTPayload;
  try {
    ({ payload } = await jwtVerify(token, settings.keys?.botFramework ?? BOT_FRAMEWORK_KEYS, {
      issuer: BOT_FRAMEWORK_ISSUER,
      audience: settings.appId,
      clockTolerance: 300,
    }));
  } catch {
    // Single-tenant bots can also receive tokens issued by our own Entra tenant.
    if (!entraKeys || entraKeysTenant !== settings.tenantId) {
      entraKeys = createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${settings.tenantId}/discovery/v2.0/keys`));
      entraKeysTenant = settings.tenantId;
    }
    ({ payload } = await jwtVerify(token, settings.keys?.entra ?? entraKeys, {
      issuer: [`https://sts.windows.net/${settings.tenantId}/`, `https://login.microsoftonline.com/${settings.tenantId}/v2.0`],
      audience: settings.appId,
      clockTolerance: 300,
    }));
  }

  // Bot Framework tokens name the serviceUrl they were issued for; it must match the activity's.
  const claimed = (payload as Record<string, unknown>).serviceurl;
  if (typeof claimed === 'string' && typeof serviceUrl === 'string' && claimed.replace(/\/$/, '') !== serviceUrl.replace(/\/$/, '')) {
    throw new Error('serviceUrl does not match the token');
  }
  return payload;
}
