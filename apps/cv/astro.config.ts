import { fileURLToPath } from 'node:url'
import react from '@astrojs/react'
import { contentIntegration } from '@cv/content-astro'
import { handlebarsCssTemplatePlugin } from '@cv/handlebars-css-template/plugin'
import {
  readPrivateContentBuildConfigFromEnv,
  readPrivateContentBuildSecretsFromEnv,
} from '@cv/private-content-config'
import { lingui } from '@lingui/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import type { AstroUserConfig } from 'astro'
import { defineConfig } from 'astro/config'
import type { Plugin as VitePlugin } from 'vite'
import { cvContentContract } from './src/cv-content/contract'

type AstroVitePlugin = NonNullable<
  NonNullable<AstroUserConfig['vite']>['plugins']
>[number]

const astroVitePlugin = (plugin: unknown): AstroVitePlugin =>
  plugin as AstroVitePlugin

const astroVitePlugins = (plugins: unknown[]): AstroVitePlugin[] =>
  plugins.map(astroVitePlugin)

const linguiConfigPath = fileURLToPath(
  new URL('./lingui.config.ts', import.meta.url)
)

const reactRendererNoExternal = ['@astrojs/react', '@astrojs/react/server.js']
const contentBuildConfig = readPrivateContentBuildConfigFromEnv()
const privateContentBuildSecrets = readPrivateContentBuildSecretsFromEnv()
const outDir = process.env.CV_ASTRO_OUT_DIR?.trim()
const devAudienceRoutePattern =
  /^\/(?<lang>[^/.?#]+)\/a\/(?<audience>[^/.?#]+)\/?$/u

const devAudienceRouteRewritePlugin = (): VitePlugin => ({
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use((request, _response, next) => {
      if (!request.url) {
        next()
        return
      }

      const url = new URL(request.url, 'http://cv.local')
      const match = url.pathname.match(devAudienceRoutePattern)

      if (match?.groups) {
        url.pathname = `/${match.groups.lang}/a/`
        request.url = `${url.pathname}${url.search}`
      }

      next()
    })
  },
  enforce: 'pre',
  name: 'cv-dev-audience-route-rewrite',
})

export default defineConfig({
  devToolbar: {
    enabled: false,
  },
  ...(outDir ? { outDir } : {}),
  integrations: [
    react({
      babel: {
        plugins: ['@lingui/babel-plugin-lingui-macro'],
      },
    }),
    contentIntegration({
      contentBuildConfig,
      contract: cvContentContract,
      privateSecrets: privateContentBuildSecrets,
    }),
  ],
  vite: {
    plugins: [
      astroVitePlugin(devAudienceRouteRewritePlugin()),
      astroVitePlugin(handlebarsCssTemplatePlugin()),
      astroVitePlugin(tailwindcss()),
      ...astroVitePlugins(
        lingui({
          configPath: linguiConfigPath,
          failOnCompileError: true,
          failOnMissing: true,
        })
      ),
    ],
    resolve: {
      noExternal: reactRendererNoExternal,
    },
    ssr: {
      noExternal: reactRendererNoExternal,
    },
  },
})
