import { fileURLToPath, URL } from 'node:url'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

import {
  defaultCvWebOrigin,
  normalizeCvWebOrigin,
  registryContentSecurityPolicy,
} from './src/host/cv-web-origin'

const contentSecurityPolicyPlaceholder = '__REGISTRY_CONTENT_SECURITY_POLICY__'

const contentSecurityPolicyPlugin = (policy: string): Plugin => ({
  name: 'application-registry-content-security-policy',
  transformIndexHtml(html) {
    if (!html.includes(contentSecurityPolicyPlaceholder)) {
      throw new Error(
        'The Registry CSP placeholder is missing from index.html.'
      )
    }
    return html.replace(contentSecurityPolicyPlaceholder, policy)
  },
})

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), 'VITE_')
  const cvWebOrigin = normalizeCvWebOrigin(
    environment.VITE_CV_WEB_ORIGIN?.trim() || defaultCvWebOrigin,
    mode === 'development'
  )

  return {
    base: mode === 'desktop' ? './' : '/',
    envPrefix: ['VITE_CV_WEB_ORIGIN', 'VITE_REGISTRY_API_URL'],
    root: 'apps/application-registry',
    plugins: [
      contentSecurityPolicyPlugin(registryContentSecurityPolicy(cvWebOrigin)),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      tailwindcss(),
    ],
    build: { outDir: 'dist', emptyOutDir: true },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
      dedupe: ['effect', '@effect/atom-react', 'react', 'react-dom'],
    },
    server: {
      port: 4300,
      strictPort: true,
    },
  }
})
