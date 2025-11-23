import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { existsSync } from 'node:fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\./i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 1 week
              },
            },
          },
        ],
      },
      includeAssets: ['favicon.ico', 'icon.svg'],
      manifest: {
        name: 'Video Call App',
        short_name: 'VideoCall',
        description: 'Secure video calling without registration',
        theme_color: '#22c55e',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['communication', 'productivity'],
        icons: [
          {
            src: 'icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'favicon.ico',
            sizes: '64x64 32x32 24x24 16x16',
            type: 'image/x-icon',
          },
        ],
      },
      devOptions: {
        enabled: true, // Enable PWA in development
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        // In Docker, use service name 'backend', otherwise use localhost
        // Check for DOCKER_ENV or if we're running in a container (has /.dockerenv)
        target: (process.env.DOCKER_ENV === 'true' || existsSync('/.dockerenv')) 
          ? 'http://backend:8000' 
          : 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxying
      },
      '/ws': {
        target: (process.env.DOCKER_ENV === 'true' || existsSync('/.dockerenv')) 
          ? 'http://backend:8000' 
          : 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
      '/admin': {
        target: (process.env.DOCKER_ENV === 'true' || existsSync('/.dockerenv')) 
          ? 'http://backend:8000' 
          : 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    target: 'esnext',
    sourcemap: true,
  },
  define: {
    __VUE_OPTIONS_API__: false,
    __VUE_PROD_DEVTOOLS__: false,
  },
})
