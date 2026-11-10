// Which build is running. deploy.sh (and the GitHub workflow) write version.json next to dist/ when packaging:
// { "commit": "abc1234", "branch": "main", "builtAt": "2026-11-10T14:05:00Z" }. Locally there is none: "dev".
import { readFileSync } from 'node:fs';

export interface Version {
  commit: string;
  branch: string;
  builtAt: string | null;
}

function read(): Version {
  for (const rel of ['../version.json', '../../version.json']) {
    try {
      const v = JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8')) as Partial<Version>;
      return { commit: String(v.commit ?? 'unknown').slice(0, 40), branch: String(v.branch ?? '').slice(0, 100), builtAt: v.builtAt ?? null };
    } catch {
      // try the next place
    }
  }
  return { commit: 'dev', branch: '', builtAt: null };
}

export const VERSION: Version = read();
