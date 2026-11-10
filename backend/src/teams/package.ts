// Section 3: builds the Teams app package (manifest.json + two icons, zipped) from this deployment's settings,
// so it always matches the live app. Download it from Stride (manager home) and upload it to your team in Teams.
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';

export interface PackageSettings {
  appUrl: string; // https://<host>
  botAppId: string;
  entraClientId: string;
  teamNumber: string;
}

// Stable Teams app id for this deployment (a UUID derived from the bot id), so re-uploads update the same app.
export function teamsAppId(botAppId: string): string {
  const h = createHash('sha256').update(`stride-teams:${botAppId}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export const TAB_ENTITY_ID = 'stride';

// Deep link that opens the Stride tab inside Teams.
export function tabDeepLink(botAppId: string): string {
  return `https://teams.microsoft.com/l/entity/${teamsAppId(botAppId)}/${TAB_ENTITY_ID}`;
}

export function manifest(s: PackageSettings, now: Date) {
  const host = new URL(s.appUrl).host;
  const pad = (n: number) => String(n).padStart(2, '0');
  // Teams needs a higher version for each re-upload: 1.YYMMDD.HHMM
  const version = `1.${String(now.getUTCFullYear()).slice(2)}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}.${now.getUTCHours() * 100 + now.getUTCMinutes()}`;
  return {
    $schema: 'https://developer.microsoft.com/json-schemas/teams/v1.17/MicrosoftTeams.schema.json',
    manifestVersion: '1.17',
    version,
    id: teamsAppId(s.botAppId),
    developer: {
      name: `Team ${s.teamNumber} (Launchpad hackathon)`,
      websiteUrl: s.appUrl,
      privacyUrl: `${s.appUrl}/privacy`,
      termsOfUseUrl: `${s.appUrl}/terms`,
    },
    name: { short: 'Stride', full: `Stride onboarding (Team ${s.teamNumber} PoC)` },
    description: {
      short: 'Onboarding journey for new colleagues, their line manager and buddy.',
      full: 'Stride guides a new colleague from offer to day one. Line managers and buddies see progress, get reminders and check-in requests in Teams, and share a team thread. Hackathon proof of concept: synthetic data only.',
    },
    icons: { color: 'color.png', outline: 'outline.png' },
    accentColor: '#006A4D',
    bots: [
      {
        botId: s.botAppId,
        scopes: ['personal', 'team'],
        isNotificationOnly: false,
        supportsFiles: false,
        supportsCalling: false,
        supportsVideo: false,
      },
    ],
    staticTabs: [
      { entityId: TAB_ENTITY_ID, name: 'Stride', contentUrl: `${s.appUrl}/?inTeams=1`, websiteUrl: s.appUrl, scopes: ['personal'] },
    ],
    permissions: ['identity', 'messageTeamMembers'],
    validDomains: [host],
    webApplicationInfo: { id: s.entraClientId, resource: `api://${host}/${s.entraClientId}` },
  };
}

export async function buildPackage(s: PackageSettings, now: Date): Promise<Buffer> {
  const assets = await assetsDir();
  return zip([
    { name: 'manifest.json', data: Buffer.from(JSON.stringify(manifest(s, now), null, 2)) },
    { name: 'color.png', data: await readFile(new URL('color.png', assets)) },
    { name: 'outline.png', data: await readFile(new URL('outline.png', assets)) },
  ]);
}

// backend/assets/teams, from dist/teams (deployed) or dist-test/src/teams (tests).
async function assetsDir(): Promise<URL> {
  for (const rel of ['../../assets/teams/', '../../../assets/teams/']) {
    const dir = new URL(rel, import.meta.url);
    if (await access(new URL('color.png', dir)).then(() => true, () => false)) return dir;
  }
  throw new Error('Teams icons not found (backend/assets/teams)');
}

// ---- Minimal zip writer (stored, no compression): enough for three small files. ----

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const DOS_DATE = (0 << 9) | (1 << 5) | 1; // 1980-01-01

export function zip(files: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name);
    const crc = crc32(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(0, 10); // time 00:00
    local.writeUInt16LE(DOS_DATE, 12); // date 1980-01-01 (a zero date is invalid in strict readers)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(f.data.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, f.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(f.data.length, 20);
    central.writeUInt32LE(f.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + f.data.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}
