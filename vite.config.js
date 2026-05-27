import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

function getAllowedHosts(env) {
  return [
    env.RAILWAY_PUBLIC_DOMAIN,
    ...(env.ALLOWED_HOSTS || '').split(',')
  ]
    .map((host) => String(host || '').trim())
    .filter(Boolean)
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const chatProxyTarget = (
    env.VITE_API_PROXY_TARGET
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
          target: chatProxyTarget,
          changeOrigin: true
        },
        '/chat': {
          target: chatProxyTarget,
          changeOrigin: true
        },
        '/files': {
          target: chatProxyTarget,
          changeOrigin: true
        }
      }
    }
  }
})
