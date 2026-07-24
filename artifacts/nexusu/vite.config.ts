import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

// Defaults allow `vite build` on Vercel/CI without Replit workflow env.
// Local Replit workflows still inject PORT / BASE_PATH when present.
const rawPort = process.env.PORT ?? '5173';
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Vercel / production root deploy: BASE_PATH=/ (or omit). Subpath hosting: set BASE_PATH=/app/
const basePath = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    // Circle PIN/email SDK (@circle-fin/w3s-pw-web-sdk) pulls Node-oriented deps
    // (jsonwebtoken, etc.) that need Buffer/process/util in the browser.
    nodePolyfills({
      include: [
        'buffer',
        'process',
        'util',
        'stream',
        'events',
        'crypto',
        'string_decoder',
        'path',
        'os',
        'assert',
      ],
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
    }),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer({
              root: path.resolve(import.meta.dirname, '..'),
            }),
          ),
          await import('@replit/vite-plugin-dev-banner').then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['@circle-fin/w3s-pw-web-sdk'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  define: {
    global: 'globalThis',
  },

  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    fs: {
      strict: true,
    },
    // Proxy Circle UC wallet API (and other /api routes) to the local api-server.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
