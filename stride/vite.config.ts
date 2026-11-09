import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Locally, /api goes to the backend (cd backend && npm run dev). Without it, Stride runs as the
// offline prototype. In Azure, App Service serves both from one origin, so no proxy is needed.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://localhost:3001' },
  },
});
