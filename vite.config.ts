import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';

// The page may load code and data only from itself. The single exception is Meta's official WhatsApp
// Cloud API, called only when the owner presses Send in automatic mode. wa.me / m.me links are
// user-clicked navigations, not requests.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://graph.facebook.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

// The dev server needs an inline React-refresh script, so the CSP is only baked into the production build.
const cspInBuild = (): Plugin => ({
  name: 'kroypulse-csp',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<!--CSP-->', `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

export default defineConfig(() => ({
  plugins: [react(), tailwindcss(), cspInBuild()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 4000, // one local bundle; nothing is downloaded over the internet
  },
  // 127.0.0.1 only: other devices on the same Wi-Fi cannot open the app or its data.
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    headers: SECURITY_HEADERS,
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    headers: { ...SECURITY_HEADERS, 'Content-Security-Policy': CSP },
  },
}));
