import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  ContentArtifactPaths,
  ContentArtifacts,
  ContentBuildConfig,
  PrivateContentBuildSecrets,
} from '@cv/content-build'
import { writeContentArtifactFiles as writeFiles } from '@cv/content-build'
import type { ContentContract } from '@cv/content-composer'
import type { AstroIntegration, AstroUserConfig } from 'astro'
import { satteriMdxPlugin } from './mdx-plugin'
import { runEffectPromise } from './node-runtime'
import { contentVitePlugin, createContentArtifactsCache } from './plugin'
import { workspaceAliases, workspaceRoot } from './vite-workspace'

type AstroVitePlugin = NonNullable<
  NonNullable<AstroUserConfig['vite']>['plugins']
>[number]

export type ContentIntegrationOptions<Content = unknown> = {
  contract: ContentContract<Content>
  contentBuildConfig: ContentBuildConfig
  privateSecrets?: PrivateContentBuildSecrets | null
  strictPrivate?: boolean
}

const astroVitePlugin = (plugin: unknown): AstroVitePlugin =>
  plugin as AstroVitePlugin

const isInsideDirectory = (directory: string, file: string) => {
  const rel = relative(directory, file)

  return rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel)
}

const artifactPaths = (outputRootDir: string): ContentArtifactPaths => ({
  outputRootDir,
  privateFilesDir: resolve(outputRootDir, '_content/files'),
  publicFilesDir: resolve(outputRootDir, 'files'),
})

const contentType = (path: string) =>
  extname(path).toLowerCase() === '.pdf'
    ? 'application/pdf'
    : 'application/octet-stream'

const generatedFileRoots = (outputRootDir: string) => [
  {
    prefix: '/_content/files/',
    root: resolve(outputRootDir, '_content/files'),
  },
  {
    prefix: '/files/',
    root: resolve(outputRootDir, 'files'),
  },
]

const resolveGeneratedRequestFile = (
  outputRootDir: string,
  requestUrl = '/'
) => {
  const pathname = new URL(requestUrl, 'http://localhost').pathname
  const route = generatedFileRoots(outputRootDir).find(({ prefix }) =>
    pathname.startsWith(prefix)
  )

  if (!route) {
    return null
  }

  let relativePath: string

  try {
    relativePath = decodeURIComponent(pathname.slice(route.prefix.length))
  } catch {
    return null
  }

  const file = resolve(route.root, relativePath)

  return isInsideDirectory(route.root, file) ? file : null
}

export const contentIntegration = <Content>({
  contract,
  contentBuildConfig,
  privateSecrets = null,
  strictPrivate = false,
}: ContentIntegrationOptions<Content>): AstroIntegration => {
  const { contentIdSalt, contentRoot } = contentBuildConfig
  const artifacts = createContentArtifactsCache({
    contentIdSalt,
    contentRoot,
    contract,
    includeAllPublicProfiles: false,
    privateSecrets,
    strictPrivate,
  })
  let devOutputRoot: string | null = null

  const emitFiles = async (
    contentArtifacts: ContentArtifacts<Content>,
    outputRootDir: string
  ) => {
    await runEffectPromise(
      writeFiles(contentArtifacts, artifactPaths(outputRootDir))
    )
  }

  return {
    hooks: {
      'astro:config:setup': async ({
        addWatchFile,
        command,
        createCodegenDir,
        updateConfig,
      }) => {
        const codegenDir = createCodegenDir()
        const devRoot = fileURLToPath(new URL('content-files/', codegenDir))

        devOutputRoot = devRoot

        addWatchFile(contentRoot)
        updateConfig({
          vite: {
            plugins: [
              astroVitePlugin(satteriMdxPlugin()),
              astroVitePlugin(
                contentVitePlugin({
                  artifacts,
                  contentRoot,
                  emitFiles:
                    command === 'dev'
                      ? (contentArtifacts) =>
                          emitFiles(contentArtifacts, devRoot)
                      : undefined,
                })
              ),
            ],
            resolve: {
              alias: [
                ...workspaceAliases,
                {
                  find: /^virtual:content$/u,
                  replacement: contract.authoringModule,
                },
                {
                  find: '#content-source',
                  replacement: contentRoot,
                },
              ],
            },
            server: {
              fs: {
                allow: [workspaceRoot, contentRoot],
              },
            },
          },
        })
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use(async (request, response, next) => {
          if (!devOutputRoot) {
            next()
            return
          }

          const file = resolveGeneratedRequestFile(devOutputRoot, request.url)

          if (!file) {
            next()
            return
          }

          try {
            const info = await stat(file)

            if (!info.isFile()) {
              next()
              return
            }

            response.statusCode = 200
            response.setHeader('Content-Length', String(info.size))
            response.setHeader('Content-Type', contentType(file))
            response.setHeader('Cache-Control', 'no-store')

            if (request.method === 'HEAD') {
              response.end()
              return
            }

            createReadStream(file).pipe(response)
          } catch {
            next()
          }
        })
      },
      'astro:build:generated': async ({ dir }) => {
        await emitFiles(await artifacts.get(), fileURLToPath(dir))
      },
    },
    name: '@cv/content-astro',
  }
}
