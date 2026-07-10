import {
  buildContentArtifacts,
  buildContentSnapshot,
  buildContentSource,
  type ContentArtifacts,
  type ContentBuildConfig,
  type ContentBuildSnapshot,
  type ContentBuildSource,
  type PrivateContentBuildSecrets,
} from '@cv/content-build'
import type { ContentContract, ContentRegistry } from '@cv/content-composer'
import { Effect } from 'effect'
import { createServer, type Plugin } from 'vite'
import { satteriMdxPlugin } from './mdx-plugin'
import { runEffectPromise } from './node-runtime'
import { renderRegistryModuleTemplate } from './templates'
import { workspaceAliases, workspaceRoot } from './vite-workspace'

const registryModuleId = 'virtual:content-build-registry'
const resolvedRegistryModuleId = `\0${registryModuleId}`

export type ContentLoaderOptions<Content = unknown> = ContentBuildConfig & {
  contract: ContentContract<Content>
  includeAllPublicProfiles?: boolean
  privateSecrets?: PrivateContentBuildSecrets | null
  strictPrivate?: boolean
}

const registryPlugin = (contentRoot: string, contentDir: string): Plugin => ({
  name: 'content-build-registry',
  resolveId(id) {
    return id === registryModuleId ? resolvedRegistryModuleId : null
  },
  load(id) {
    if (id !== resolvedRegistryModuleId) {
      return null
    }

    return runEffectPromise(
      renderRegistryModuleTemplate({
        contentDir,
        contentRoot,
      })
    )
  },
})

const createContentServer = async <Content>({
  contentRoot,
  contract,
}: ContentLoaderOptions<Content>) =>
  createServer({
    appType: 'custom',
    configFile: false,
    logLevel: 'silent',
    oxc: {
      jsx: {
        importSource: 'react',
        runtime: 'automatic',
      },
    },
    plugins: [
      satteriMdxPlugin(),
      registryPlugin(contentRoot, contract.contentDir),
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
    root: workspaceRoot,
    server: {
      fs: {
        allow: [workspaceRoot, contentRoot],
      },
      middlewareMode: true,
    },
  })

const loadRegistry = async <Content>(
  options: ContentLoaderOptions<Content>
) => {
  const server = await createContentServer(options)

  try {
    const loaded = (await server.ssrLoadModule(registryModuleId)) as {
      registry?: ContentRegistry
    }

    if (!loaded.registry) {
      throw new Error('Content registry module did not export registry')
    }

    return loaded.registry
  } finally {
    await server.close()
  }
}

export const loadContentSnapshot = async <Content>(
  options: ContentLoaderOptions<Content>
): Promise<ContentBuildSnapshot<Content>> => {
  const registry = await loadRegistry(options)

  return runEffectPromise(
    buildContentSnapshot(registry, options.contract, {
      config: {
        contentIdSalt: options.contentIdSalt,
        contentRoot: options.contentRoot,
      },
      includeAllPublicProfiles: options.includeAllPublicProfiles,
      privateSecrets: options.privateSecrets,
      strictPrivate: options.strictPrivate,
    })
  )
}

export const loadContentSource = async <Content>(
  options: Pick<ContentLoaderOptions<Content>, 'contentRoot' | 'contract'>
): Promise<ContentBuildSource<Content>> => {
  const registry = await loadRegistry({
    contentIdSalt: '',
    contract: options.contract,
    contentRoot: options.contentRoot,
  })

  return Effect.runPromise(buildContentSource(registry, options.contract))
}

export const loadContentArtifacts = async <Content>(
  options: ContentLoaderOptions<Content>
): Promise<ContentArtifacts<Content>> => {
  const registry = await loadRegistry(options)

  return runEffectPromise(
    buildContentArtifacts(registry, options.contract, {
      config: {
        contentIdSalt: options.contentIdSalt,
        contentRoot: options.contentRoot,
      },
      includeAllPublicProfiles: options.includeAllPublicProfiles,
      privateSecrets: options.privateSecrets,
      strictPrivate: options.strictPrivate,
    })
  )
}
