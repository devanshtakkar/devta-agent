import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon-32x32.png', 'favicon-16x16.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'd-frontend',
        short_name: 'd-frontend',
        description: 'd-frontend web app',
        theme_color: '#16171d',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'icons/icon-192.webp',
            sizes: '192x192',
            type: 'image/webp',
          },
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.webp',
            sizes: '512x512',
            type: 'image/webp',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
      },
      devOptions: {
        // vite-plugin-pwa disables PWA in `vite dev` by default —
        // this is why "Install app" disappeared after the monorepo move.
        // Enabling it serves /manifest.webmanifest + dev SW on localhost.
        enabled: true,
        navigateFallback: 'index.html',
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    host: true,
    allowedHosts: ['.minepicoin.com'],
  },
})
