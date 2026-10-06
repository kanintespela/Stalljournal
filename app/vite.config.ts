import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

// Versionsinfo som visas under Mer, så att man kan se vilken version en
// installerad app faktiskt kör: kort commit-hash + byggtidpunkt.
function gitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'okänd'
  }
}

export default defineConfig({
  define: {
    __APP_COMMIT__: JSON.stringify(gitCommit()),
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt': en ny version tar inte över förrän användaren trycker
      // "Uppdatera" i bannern (components/UpdateBanner.tsx) — så att en
      // uppdatering aldrig laddar om sidan mitt i ett ifyllt formulär.
      registerType: 'prompt',
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
