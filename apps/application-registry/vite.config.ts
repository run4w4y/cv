import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type ProxyOptions } from 'vite'

const registryApiProxyPath = '/api/registry'
const workerProxyPaths = ['/api/chatgpt'] as const

const authorizedProxy = ({
  target,
  token,
  rewrite,
}: {
  readonly target: string
  readonly token?: string
  readonly rewrite?: (path: string) => string
}): ProxyOptions => ({
  target,
  changeOrigin: true,
  rewrite,
  configure: (proxy) => {
    if (token === undefined) return
    proxy.on('proxyReq', (request) => {
      request.setHeader('authorization', `Bearer ${token}`)
    })
  },
})

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
        [registryApiProxyPath]: authorizedProxy({
          target: registryApiUrl,
          token: registryApiToken,
          rewrite: (path) => path.slice(registryApiProxyPath.length),
        }),
        ...Object.fromEntries(
          workerProxyPaths.map((path) => [
            path,
            authorizedProxy({
              target: registryApiUrl,
              token: registryApiToken,
            }),
          ])
        ),
      },
    },
  }
})
