import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 3000,
    open: true,
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png', 'robots.txt'],
      workbox: {
        // Fonts are bundled now, so there is nothing to cache from a third
        // party and no runtime rules are needed - precaching covers everything.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
        // pdfjs and jspdf push the precache over the 2 MB default.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'OffFile - Privacy-First File Tools',
        short_name: 'OffFile',
        description:
          'Browser-based file tools. Merge PDFs, convert images - 100% offline, no uploads.',
        theme_color: '#ffe600',
        background_color: '#f5f0de',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        lang: 'en',
        categories: ['utilities', 'productivity'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: 'icons/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
});
