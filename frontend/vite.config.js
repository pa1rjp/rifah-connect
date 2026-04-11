import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (req) => {
            req.setHeader('Host', 'rifah.localhost')
            req.removeHeader('Cookie') // prevent sid cookie from triggering CSRF check; token auth handles auth
          })
        },
      },
      '/files': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (req) => req.setHeader('Host', 'rifah.localhost'))
        },
      },
    },
  },
})
