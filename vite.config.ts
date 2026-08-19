import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// The app is deployed to https://<user>.github.io/heritagetree/, so every asset
// URL needs that prefix. Override with BASE_PATH=/ when hosting at a domain root.
const base = process.env.BASE_PATH ?? '/heritagetree/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Heritage Tree',
        short_name: 'Heritage',
        description: 'Build and explore your family tree, entirely on your own device.',
        theme_color: '#1f2a37',
        background_color: '#f7f5f0',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
