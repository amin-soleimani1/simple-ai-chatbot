import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'کالای روشنایی کیان',
        short_name: 'کیان',
        lang: 'fa',
        dir: 'rtl',
        start_url: '/simple-ai-chatbot/',
        scope: '/simple-ai-chatbot/',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
        background_color: '#090709',
        theme_color: '#090709',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp}'],
        navigateFallback: '/simple-ai-chatbot/index.html',
      },
    }),
  ],
  base: "/simple-ai-chatbot/",
})
