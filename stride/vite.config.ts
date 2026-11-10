import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

// The build's version, shown in the footer for testing: git commit and branch, and when it was built.
// STRIDE_COMMIT / STRIDE_BRANCH override git (e.g. in CI); without git it says "dev".
function git(args: string): string {
  try {
    return execSync(`git ${args}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
}
const version = {
  commit: process.env.STRIDE_COMMIT || git('rev-parse --short HEAD') || 'dev',
  branch: process.env.STRIDE_BRANCH || git('rev-parse --abbrev-ref HEAD'),
  builtAt: new Date().toISOString(),
};

// Locally, /api goes to the backend (cd backend && npm run dev). Without it, Stride runs as the
// offline prototype. In Azure, App Service serves both from one origin, so no proxy is needed.
export default defineConfig({
  plugins: [react()],
  define: { __STRIDE_VERSION__: JSON.stringify(version) },
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
});
