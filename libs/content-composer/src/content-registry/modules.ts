import { type NormalizeContentKeyOptions, normalizeContentKey } from './keys'
import type { ContentModule, ContentRegistry } from './types'

const contentModuleExtensions = ['.tsx', '.ts', '.jsx', '.js'] as const

export const normalizeModules = <Module extends ContentModule>(
  modules: Record<string, Module>,
  options: NormalizeContentKeyOptions = {}
) => {
  const normalizedModules: Record<string, Module> = {}
  const originalPaths = new Map<string, string>()

  for (const [path, module] of Object.entries(modules)) {
    const key = normalizeContentKey(path, options)
    const existing = originalPaths.get(key)

    if (existing) {
      throw new Error(
        `Duplicate content module key "${key}" from ${existing} and ${path}.`
      )
    }

    originalPaths.set(key, path)
    normalizedModules[key] = module
  }

  return normalizedModules
}

const findContentModule = (
  relativeBasePath: string,
  registry: ContentRegistry
) => {
  for (const extension of contentModuleExtensions) {
    const relativePath = `${relativeBasePath}${extension}`
    const module = registry.modules[relativePath]

    if (module) {
      return {
        module,
        relativePath,
      }
    }
  }

  return undefined
}

export const readContentModule = <T>(
  relativeBasePath: string,
  registry: ContentRegistry
) => {
  const match = findContentModule(relativeBasePath, registry)

  if (!match) {
    throw new Error(
      `Missing content source module ${relativeBasePath}. Tried: ${contentModuleExtensions
        .map((extension) => `${relativeBasePath}${extension}`)
        .join(', ')}`
    )
  }

  return {
    data: match.module.default as T,
    relativePath: match.relativePath,
  }
}

export const readOptionalContentModule = <T>(
  relativeBasePath: string,
  registry: ContentRegistry
) => {
  const match = findContentModule(relativeBasePath, registry)

  return match
    ? {
        data: match.module.default as T,
        relativePath: match.relativePath,
      }
    : null
}

export const listContentFiles = (registry: ContentRegistry) =>
  [
    ...new Set([
      ...Object.keys(registry.modules),
      ...Object.keys(registry.mdxModules),
    ]),
  ].sort()
