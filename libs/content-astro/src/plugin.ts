import { isAbsolute, relative } from 'node:path'
import type { ContentArtifacts } from '@cv/content-build'
import type { Plugin, ViteDevServer } from 'vite'
import {
  type ContentLoaderOptions,
  loadContentArtifacts,
} from './load-snapshot'
import { runEffectPromise } from './node-runtime'
import {
  contentVirtualModuleId,
  createContentPrivateRuntimeProfileVirtualModuleSource,
  createContentRuntimeVirtualModuleSource,
  createContentVirtualModuleSource,
  parseContentPrivateRuntimeProfileVirtualModuleId,
  resolvedContentRuntimeVirtualModuleId,
  resolvedContentVirtualModuleId,
} from './virtual-module'

export type ContentArtifactsCache = {
  get: () => Promise<ContentArtifacts>
  reset: () => void
}

export type ContentVitePluginOptions = {
  artifacts: ContentArtifactsCache
  contentRoot: string
  emitFiles?: (artifacts: ContentArtifacts) => Promise<void>
}

const isInsideDirectory = (directory: string, file: string) => {
  const rel = relative(directory, file)

  return rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel)
}

export const createContentArtifactsCache = (
  options: ContentLoaderOptions
): ContentArtifactsCache => {
  let artifactsPromise: Promise<ContentArtifacts> | undefined
  let artifactsQueue: Promise<unknown> = Promise.resolve()

  const createArtifacts = () => {
    const promise = artifactsQueue.then(() => loadContentArtifacts(options))

    artifactsQueue = promise.catch(() => undefined)

    return promise
  }

  return {
    get: () => {
      artifactsPromise ??= createArtifacts().catch((error) => {
        artifactsPromise = undefined

        throw error
      })

      return artifactsPromise
    },
    reset: () => {
      artifactsPromise = undefined
    },
  }
}

export const contentVitePlugin = ({
  artifacts,
  contentRoot,
  emitFiles,
}: ContentVitePluginOptions): Plugin => {
  const formatError = (error: unknown) =>
    error instanceof Error && error.stack ? error.stack : String(error)

  const invalidateVirtualModules = (server: ViteDevServer) => {
    const modules = [...server.moduleGraph.idToModuleMap.entries()]
      .filter(
        ([id]) =>
          id === resolvedContentVirtualModuleId ||
          id.startsWith(`${resolvedContentVirtualModuleId}/`)
      )
      .map(([, module]) => module)

    for (const module of modules) {
      server.moduleGraph.invalidateModule(module)
    }
  }

  const emitArtifacts = () =>
    artifacts.get().then(async (contentArtifacts) => {
      await emitFiles?.(contentArtifacts)
    })

  const reset = () => {
    artifacts.reset()
  }

  const rebuildArtifacts = async (server: ViteDevServer) => {
    reset()
    invalidateVirtualModules(server)

    try {
      await emitArtifacts()
    } catch (error) {
      server.config.logger.error(
        `[content-astro] Could not rebuild content artifacts:\n${formatError(
          error
        )}`
      )

      throw error
    }
  }

  return {
    name: 'content-virtual-module',
    async buildStart() {
      await emitArtifacts()
    },
    configureServer(server) {
      server.watcher.add(contentRoot)
    },
    async handleHotUpdate(context) {
      if (!isInsideDirectory(contentRoot, context.file)) {
        return
      }

      await rebuildArtifacts(context.server)

      return []
    },
    async load(id) {
      if (id === resolvedContentVirtualModuleId) {
        return runEffectPromise(
          createContentVirtualModuleSource(await artifacts.get())
        )
      }

      if (id === resolvedContentRuntimeVirtualModuleId) {
        return runEffectPromise(
          createContentRuntimeVirtualModuleSource(await artifacts.get())
        )
      }

      const privateRuntimeProfile =
        parseContentPrivateRuntimeProfileVirtualModuleId(id)

      return privateRuntimeProfile
        ? createContentPrivateRuntimeProfileVirtualModuleSource(
            await artifacts.get(),
            privateRuntimeProfile
          )
        : null
    },
    resolveId(id) {
      if (id === contentVirtualModuleId) {
        return resolvedContentVirtualModuleId
      }

      return id.startsWith(`${contentVirtualModuleId}/`) ? `\0${id}` : null
    },
  }
}
