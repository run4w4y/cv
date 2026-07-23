import { fileURLToPath, URL } from 'node:url'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  const desktopPublicCvBaseUrl =
    mode === 'desktop' && environment.CV_WEB_HOST
      ? `https://${environment.CV_WEB_HOST}/c`
      : ''

  return {
    base: mode === 'desktop' ? './' : '/',
    envPrefix: ['VITE_CV_PUBLIC_BASE_URL', 'VITE_REGISTRY_API_URL'],
    ...(mode === 'desktop'
      ? {
          define: {
            'import.meta.env.VITE_CV_PUBLIC_BASE_URL': JSON.stringify(
              environment.VITE_CV_PUBLIC_BASE_URL ?? desktopPublicCvBaseUrl
            ),
          },
        }
      : {}),
    root: 'apps/application-registry',
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],
    build: { outDir: 'dist', emptyOutDir: true },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 4300,
      strictPort: true,
    },
  }
})
