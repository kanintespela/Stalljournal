import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      // start_url/scope och navigateFallback härleds från Vites "base"
      // (sätts med --base=/Stalljournal/ vid GitHub Pages-bygget)
      manifest: {
        name: 'Stalljournal',
        short_name: 'Stalljournal',
        description: 'Digital stalljournal för fårproducenter',
        lang: 'sv',
        display: 'standalone',
        background_color: '#f5f2ec',
        theme_color: '#3d5a3d',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,pdf}'],
      },
    }),
  ],
})
