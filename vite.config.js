import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function getAllowedHosts(env) {
  return [
    ...(env.ALLOWED_HOSTS || '').split(',')
  ]
    .map((host) => String(host || '').trim())
    .filter(Boolean)
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = (
    env.VITE_API_URL || env.VITE_API_PROXY_TARGET || 'http://localhost:3000'
  ).replace(/\/$/, '')

  return {
    plugins: [react()],
    preview: {
      allowedHosts: getAllowedHosts(env)
    },
    server: {
      port: 5173,
      proxy: {
        '/auth': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/admin': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/cart': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/billing': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/chat': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/voice-chat': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/homepage': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/tours': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/birds': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/jobs': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/addons': {
          target: proxyTarget,
          changeOrigin: true
        },
        '/files': {
          target: proxyTarget,
          changeOrigin: true
        }
      }
    }
  }
})
