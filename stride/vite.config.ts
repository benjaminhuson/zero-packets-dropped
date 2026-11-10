import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// Locally, /api goes to the backend (cd backend && npm run dev). Without it, Stride runs as the
// offline prototype. In Azure, App Service serves both from one origin, so no proxy is needed.
//
// Testing the camera on a phone needs a secure (https) page. Run `HTTPS=1 npm run dev -- --host`
// and open https://<this computer's LAN address>:5173 on the phone (accept the self-signed certificate once).
declare const process: { env: Record<string, string | undefined> };
const https = process.env.HTTPS === '1';

export default defineConfig({
  plugins: [react(), ...(https ? [basicSsl()] : [])],
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
});
