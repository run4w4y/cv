import { lstat, readdir, readFile } from 'node:fs/promises'
import {
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
  win32,
} from 'node:path'
import {
  type ContentModule,
  type ContentRegistry,
  type ContentRepositoryConfig,
  type ContentSectionKind,
  loadContentRepository,
  type MdxModule,
  type ResolvedContentRepositoryConfig,
  resolveContentRepositoryConfig,
} from '@cv/content-composer'
import type { Locale, ProfileSlug } from '@cv/content-core'
import { createServer } from 'vite'
import { workspaceRoot } from './vite-workspace'

const sourceExtensions = ['.tsx', '.ts', '.jsx', '.js', '.mdx'] as const
const moduleExtensions = ['.tsx', '.ts', '.jsx', '.js'] as const
const ignoredDirectories = new Set([
  '_files',
  'coverage',
  'deps',
  'dist',
  'files',
  'node_modules',
])
const declarationPattern = /\.d\.tsx?$/u
const testPattern = /\.(?:test|spec)\.(?:mdx|tsx?|jsx?)$/u

const normalizePath = (path: string) => path.replaceAll('\\', '/')

const isSourceFile = (path: string) =>
  sourceExtensions.some((extension) => path.endsWith(extension)) &&
  !declarationPattern.test(path) &&
  !testPattern.test(path)

const isIgnoredDirectory = (name: string) =>
  name.startsWith('.') || ignoredDirectories.has(name)

const fileKind = (path: string): ContentSectionKind =>
  extname(path) === '.mdx' ? 'mdx' : 'module'

const pathType = async (path: string) => {
  try {
    const stats = await lstat(path)

    if (stats.isSymbolicLink()) {
      return 'symlink' as const
    }

    if (stats.isDirectory()) {
      return 'directory' as const
    }

    return stats.isFile() ? ('file' as const) : ('other' as const)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return 'missing' as const
    }

    throw error
  }
}

const firstExistingModule = async (basePath: string) => {
  for (const extension of moduleExtensions) {
    const candidate = `${basePath}${extension}`

    if ((await pathType(candidate)) === 'file') {
      return candidate
    }
  }

  return undefined
}

const listSourceFiles = async (directory: string): Promise<string[]> => {
  if ((await pathType(directory)) !== 'directory') {
    return []
  }

  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue
    }

    const entryPath = join(directory, entry.name)

    if (entry.isDirectory()) {
      if (!isIgnoredDirectory(entry.name)) {
        files.push(...(await listSourceFiles(entryPath)))
      }
      continue
    }

    if (entry.isFile() && isSourceFile(entryPath)) {
      files.push(entryPath)
    }
  }

  return files.sort((left, right) => left.localeCompare(right))
}

const normalizeContentDirectory = (directory: string) => {
  const source = directory.trim()

  if (isAbsolute(source) || win32.isAbsolute(source)) {
    throw new Error(
      `Content directory must be repository-relative: ${directory}`
    )
  }

  const normalized = normalizePath(source).replace(/^\/+|\/+$/gu, '')
  const segments = normalized.split('/').filter(Boolean)

  if (
    segments.length === 0 ||
    segments.some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error(`Invalid content directory "${directory}".`)
  }

  return segments.join('/')
}

const relativeModulePath = (contentRoot: string, file: string) =>
  normalizePath(relative(contentRoot, file))

const viteModuleId = (path: string) => {
  const normalized = normalizePath(path)

  return isAbsolute(normalized) ? `/@fs${normalized}` : normalized
}

const loadRepositoryConfigModule = async (
  contentRoot: string,
  configPath: string
): Promise<unknown> => {
  const server = await createServer({
    appType: 'custom',
    configFile: false,
    logLevel: 'silent',
    root: workspaceRoot,
    server: {
      fs: {
        allow: [workspaceRoot, contentRoot],
      },
      middlewareMode: true,
    },
  })

  try {
    const loaded = (await server.ssrLoadModule(viteModuleId(configPath))) as {
      default?: unknown
    }

    if (loaded.default === undefined) {
      throw new Error(`${configPath} must have a default export.`)
    }

    return loaded.default
  } finally {
    await server.close()
  }
}

const requireConfiguredString = (
  config: Readonly<Record<string, unknown>>,
  field: 'contentDir' | 'defaultLocale' | 'defaultProfile'
) => {
  const value = config[field]

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(
      `Content repository config must define a non-empty ${field}.`
    )
  }

  return value
}

const loadContentRepositoryConfigSource = async (contentRoot: string) => {
  const configPath = await firstExistingModule(
    join(contentRoot, 'content.config')
  )

  if (!configPath) {
    throw new Error(`Missing content repository config under ${contentRoot}.`)
  }

  const source = await loadRepositoryConfigModule(contentRoot, configPath)
  const configObject =
    typeof source === 'object' && source !== null
      ? (source as Readonly<Record<string, unknown>>)
      : {}
  const contentDir = normalizeContentDirectory(
    requireConfiguredString(configObject, 'contentDir')
  )
  requireConfiguredString(configObject, 'defaultLocale')
  requireConfiguredString(configObject, 'defaultProfile')

  return {
    config: resolveContentRepositoryConfig({ ...configObject, contentDir }),
    configPath,
  }
}

export const loadContentRepositoryConfig = async ({
  contentRoot,
}: {
  readonly contentRoot: string
}): Promise<ResolvedContentRepositoryConfig> =>
  (await loadContentRepositoryConfigSource(resolve(contentRoot))).config

const sourceRegistry = ({
  config,
  configPath,
  contentRoot,
  profileFiles,
}: {
  config: ContentRepositoryConfig
  configPath: string
  contentRoot: string
  profileFiles: readonly string[]
}): ContentRegistry => {
  const modules: Record<string, ContentModule> = {
    [relativeModulePath(contentRoot, configPath)]: { default: config },
  }
  const mdxModules: Record<string, MdxModule> = {}

  for (const file of profileFiles) {
    const path = relativeModulePath(contentRoot, file)

    if (file.endsWith('.mdx')) {
      mdxModules[path] = { default: () => null }
    } else {
      modules[path] = { default: {} }
    }
  }

  return { mdxModules, modules }
}

const assertInsideRoot = (contentRoot: string, modulePath: string) => {
  const root = resolve(contentRoot)
  const file = resolve(root, modulePath)
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`

  if (file !== root && !file.startsWith(prefix)) {
    throw new Error(`Content source escaped its repository root: ${modulePath}`)
  }

  return file
}

export type AuthoredContentSource = {
  readonly kind: ContentSectionKind
  readonly locale: Locale
  readonly modulePath: string
  readonly path: readonly string[]
  readonly profile: ProfileSlug
  readonly source: string
  readonly sourceProfile: ProfileSlug
}

export type AuthoredContentProfileLayer = {
  readonly locale: Locale
  readonly profile: ProfileSlug
  readonly sources: readonly AuthoredContentSource[]
}

export type AuthoredContentSharedSource = {
  readonly kind: ContentSectionKind
  readonly modulePath: string
  readonly source: string
}

export type AuthoredContentProfile = {
  readonly defaultProfile: ProfileSlug
  readonly layers: readonly AuthoredContentProfileLayer[]
  readonly locale: Locale
  readonly profile: ProfileSlug
  readonly sharedSources: readonly AuthoredContentSharedSource[]
}

export type AuthoredContentSourceRepository = {
  readonly availableProfiles: Readonly<Record<Locale, readonly ProfileSlug[]>>
  readonly config: ResolvedContentRepositoryConfig
  readonly loadProfileSources: (input: {
    readonly locale: Locale
    readonly profile: ProfileSlug
  }) => Promise<AuthoredContentProfile>
  readonly profiles: readonly ProfileSlug[]
}

const readSharedSources = async (
  contentRoot: string,
  files: readonly string[]
): Promise<readonly AuthoredContentSharedSource[]> =>
  Promise.all(
    files.map(async (file) => ({
      kind: fileKind(file),
      modulePath: relativeModulePath(contentRoot, file),
      source: await readFile(file, 'utf8'),
    }))
  )

export const openContentSourceRepository = async ({
  contentRoot,
}: {
  readonly contentRoot: string
}): Promise<AuthoredContentSourceRepository> => {
  const root = resolve(contentRoot)
  const { config: sourceConfig, configPath } =
    await loadContentRepositoryConfigSource(root)
  const contentDir = sourceConfig.contentDir
  const contentRootDir = join(root, contentDir)
  const profileFiles = await listSourceFiles(join(contentRootDir, 'profiles'))
  const sharedFiles = (await listSourceFiles(contentRootDir)).filter(
    (file) =>
      !normalizePath(relative(contentRootDir, file)).startsWith('profiles/')
  )
  const repository = loadContentRepository(
    sourceRegistry({
      config: sourceConfig,
      configPath,
      contentRoot: root,
      profileFiles,
    })
  )
  const sharedSources = await readSharedSources(root, sharedFiles)
  const availableProfiles: Record<Locale, readonly ProfileSlug[]> =
    Object.fromEntries(
      repository.config.locales.map((locale) => [
        locale,
        repository.profiles.filter(
          (profile) => repository.listSourceSections(locale, profile).length > 0
        ),
      ])
    )

  const readLayer = async (
    locale: Locale,
    profile: ProfileSlug
  ): Promise<AuthoredContentProfileLayer> => ({
    locale,
    profile,
    sources: await Promise.all(
      repository.listSourceSections(locale, profile).map(async (section) => ({
        kind: section.kind,
        locale: section.locale,
        modulePath: section.modulePath,
        path: section.path,
        profile: section.profile,
        source: await readFile(
          assertInsideRoot(root, section.modulePath),
          'utf8'
        ),
        sourceProfile: section.sourceProfile,
      }))
    ),
  })

  return {
    availableProfiles,
    config: repository.config,
    loadProfileSources: async ({ locale, profile }) => {
      if (!repository.config.locales.includes(locale)) {
        throw new Error(`Unknown content locale "${locale}".`)
      }

      if (!(availableProfiles[locale] ?? []).includes(profile)) {
        throw new Error(
          `No authored content is available for ${locale}/${profile}.`
        )
      }

      const layerProfiles =
        profile === repository.config.defaultProfile
          ? [profile]
          : [repository.config.defaultProfile, profile]

      return {
        defaultProfile: repository.config.defaultProfile,
        layers: await Promise.all(
          layerProfiles.map((sourceProfile) => readLayer(locale, sourceProfile))
        ),
        locale,
        profile,
        sharedSources,
      }
    },
    profiles: repository.profiles,
  }
}
