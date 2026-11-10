// Loads the demo colleagues into Stride's Cosmos DB. Run it through infra/seed-demo.sh, which fills in the settings.
//   node dist/scripts/seed-demo.js --manager <upn> --buddy <upn> [--dry-run]
// Prints the sign-in details to this terminal only. Don't paste them anywhere public.
import { CosmosStore } from '../store/cosmos.js';
import { MemoryStore } from '../store/memory.js';
import { seedDemo } from '../demo/seed.js';
import type { Store } from '../contracts.js';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const manager = arg('manager');
const buddy = arg('buddy');
const dryRun = process.argv.includes('--dry-run');
if (!manager || !buddy) {
  console.error('Usage: node dist/scripts/seed-demo.js --manager <upn> --buddy <upn> [--dry-run]');
  process.exit(1);
}

const store: Store = dryRun
  ? new MemoryStore()
  : new CosmosStore(process.env.AZURE_COSMOS_ENDPOINT ?? '', process.env.AZURE_COSMOS_DATABASE ?? 'stride');

const rows = await seedDemo(store, { managerUpn: manager, buddyUpn: buddy, now: new Date() });

const width = (k: keyof (typeof rows)[number]) => Math.max(k.length, ...rows.map((r) => String(r[k] ?? '').length));
const cols = ['name', 'email', 'stage', 'buddy'] as const;
const line = (r: object) => cols.map((c) => String((r as Record<string, unknown>)[c] ?? '').padEnd(width(c))).join('  ');
console.log(dryRun ? '\nDRY RUN: nothing was saved.\n' : '');
console.log(line({ name: 'Name', email: 'Email (Stride sign-in)', stage: 'Stage', buddy: 'Buddy' }));
for (const r of rows) {
  const secret = r.password ? `password ${r.password}` : r.inviteCode ? `invite code ${r.inviteCode}` : '';
  console.log(`${line(r)}  ${secret}`);
}
const added = rows.filter((r) => !r.skipped).length;
console.log(`\n${added} added, ${rows.length - added} already there. Line manager: ${manager}`);
console.log('Keep these passwords and codes to yourself: they are only shown here, once.');
