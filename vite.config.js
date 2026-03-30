import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      devOptions: { enabled: true },
      manifest: {
        name: 'WARVAN DOMINOS',
        short_name: 'WARVAN',
        description: 'AI-powered domino game scoreboard.',
        theme_color: '#121216',
        background_color: '#121216',
        display: 'standalone',
        start_url: '/'
      }
    })
  ],
})
