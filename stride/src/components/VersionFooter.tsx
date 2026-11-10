import { useEffect, useState } from 'react';

type Version = { commit: string; branch: string; builtAt: string | null };

const WEB: Version = __STRIDE_VERSION__;

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';

// Which version someone is using, at the bottom of every screen, for testing reference.
// "web" is the front end in their browser; "server" is the API. They should match after a deploy;
// a mismatch (highlighted) usually means the browser has an old copy: refresh the page.
export function VersionFooter() {
  const [server, setServer] = useState<Version | null>(null);
  useEffect(() => {
    void fetch('/api/version').then((r) => (r.ok ? r.json() : null)).then(setServer).catch(() => setServer(null));
  }, []);
  const mismatch = !!server && server.commit !== 'dev' && WEB.commit !== 'dev' && server.commit.slice(0, 7) !== WEB.commit.slice(0, 7);
  return (
    <footer className="version-footer">
      Stride · web <code>{WEB.commit}</code>{WEB.branch && WEB.branch !== 'HEAD' && <> ({WEB.branch})</>} · built {when(WEB.builtAt)}
      {server && (
        <span className={mismatch ? 'mismatch' : undefined}>
          {' '}· server <code>{server.commit.slice(0, 7)}</code>{server.builtAt && <> · deployed {when(server.builtAt)}</>}
          {mismatch && ' · versions differ: refresh the page'}
        </span>
      )}
    </footer>
  );
}
