import tailwindcss from '@tailwindcss/vite'
import babel from '@rolldown/plugin-babel'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const apiProxyPath = '/api/registry'

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  const registryApiUrl = environment.REGISTRY_API_URL ?? 'http://127.0.0.1:8787'
  const registryApiToken = environment.REGISTRY_API_TOKEN

  return {
    root: 'apps/application-registry',
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],
    build: { outDir: 'dist', emptyOutDir: true },
    server: {
      port: 4300,
      strictPort: true,
      proxy: {
        [apiProxyPath]: {
          target: registryApiUrl,
          changeOrigin: true,
          rewrite: (path) => path.slice(apiProxyPath.length),
          configure: (proxy) => {
            if (registryApiToken === undefined) return
            proxy.on('proxyReq', (request) => {
              request.setHeader('authorization', `Bearer ${registryApiToken}`)
            })
          },
        },
      },
    },
  }
})
