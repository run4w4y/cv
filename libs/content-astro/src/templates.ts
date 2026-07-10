import { existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { Effect } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import type { PlatformError } from 'effect/PlatformError'
import Handlebars from 'handlebars'
import { workspaceRoot } from './vite-workspace'

Handlebars.registerHelper('json', (value: unknown) => JSON.stringify(value))

export type ContentGeneratedTemplateContext = {
  readonly locales: string
  readonly privateRoutes: string
}

export type ContentRuntimeTemplateContext = {
  readonly defaultLocale: string
  readonly defaultProfileSlug: string
  readonly fileIndex: string
  readonly manifest: string
  readonly privateRuntimeProfileLoaders: string
}

export type ContentRegistryTemplateContext = {
  readonly contentDir: string
  readonly contentRoot: string
}

type ContentRegistryTemplateRenderContext = ContentRegistryTemplateContext & {
  readonly mdxEntries: string
  readonly mdxImports: string
  readonly moduleEntries: string
  readonly moduleImports: string
}

const normalizePath = (path: string) => path.replaceAll('\\', '/')
const sourceExtensions = ['.tsx', '.ts', '.jsx', '.js', '.mdx'] as const
const moduleExtensions = ['.tsx', '.ts', '.jsx', '.js'] as const
const ignoredDirectoryNames = new Set([
  '.direnv',
  '.git',
  '_files',
  'coverage',
  'dist',
  'node_modules',
])
const declarationPattern = /\.d\.tsx?$/u
const testPattern = /\.(?:test|spec)\.(?:mdx|tsx?|jsx?)$/u

const normalizeContentDirectory = (directory: string) => {
  const normalized = normalizePath(directory.trim())
    .replace(/^\/+/u, '')
    .replace(/\/+$/u, '')
  const segments = normalized.split('/').filter(Boolean)

  if (
    segments.length === 0 ||
    segments.some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error(`Invalid content directory "${directory}".`)
  }

  return segments.join('/')
}

const isSourceFile = (path: string) =>
  sourceExtensions.some((extension) => path.endsWith(extension)) &&
  !declarationPattern.test(path) &&
  !testPattern.test(path)

const isIgnoredDirectory = (name: string) =>
  name.startsWith('.') || ignoredDirectoryNames.has(name)

const listSourceFiles = (directory: string): string[] =>
  existsSync(directory)
    ? readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = join(directory, entry.name)

        if (entry.isDirectory()) {
          return isIgnoredDirectory(entry.name)
            ? []
            : listSourceFiles(entryPath)
        }

        return entry.isFile() && isSourceFile(entryPath) ? [entryPath] : []
      })
    : []

const firstExistingModule = (basePath: string) =>
  moduleExtensions
    .map((extension) => `${basePath}${extension}`)
    .find(existsSync)

const listRegistrySourceFiles = ({
  contentDir,
  contentRoot,
}: ContentRegistryTemplateContext) => {
  const directory = normalizeContentDirectory(contentDir)
  const rootConfig = firstExistingModule(join(contentRoot, 'content.config'))
  const variables = firstExistingModule(
    join(contentRoot, directory, 'variables')
  )
  const profiles = listSourceFiles(join(contentRoot, directory, 'profiles'))

  return [
    ...(rootConfig ? [rootConfig] : []),
    ...(variables ? [variables] : []),
    ...profiles,
  ].sort((left, right) =>
    relative(contentRoot, left).localeCompare(relative(contentRoot, right))
  )
}

const viteFileImportPath = (path: string) => {
  const normalized = normalizePath(path)

  return normalized.startsWith('/') ? `/@fs${normalized}` : normalized
}

const importName = (kind: 'contentModule' | 'mdxModule', index: number) =>
  `${kind}${index}`

const moduleImports = (
  files: readonly string[],
  kind: 'contentModule' | 'mdxModule'
) =>
  files
    .map(
      (file, index) =>
        `import * as ${importName(kind, index)} from ${JSON.stringify(
          viteFileImportPath(file)
        )}`
    )
    .join('\n')

const moduleEntries = (
  files: readonly string[],
  kind: 'contentModule' | 'mdxModule'
) =>
  files
    .map(
      (file, index) =>
        `${JSON.stringify(viteFileImportPath(file))}: ${importName(
          kind,
          index
        )}`
    )
    .join(',\n    ')

const registryTemplateContext = (
  context: ContentRegistryTemplateContext
): ContentRegistryTemplateRenderContext => {
  const files = listRegistrySourceFiles(context)
  const mdxFiles = files.filter((file) => file.endsWith('.mdx'))
  const contentFiles = files.filter((file) => !file.endsWith('.mdx'))

  return {
    ...context,
    mdxEntries: moduleEntries(mdxFiles, 'mdxModule'),
    mdxImports: moduleImports(mdxFiles, 'mdxModule'),
    moduleEntries: moduleEntries(contentFiles, 'contentModule'),
    moduleImports: moduleImports(contentFiles, 'contentModule'),
  }
}

const templatePath = (name: string) => {
  const candidates = [
    join(workspaceRoot, 'libs/content-astro/templates', name),
    join(workspaceRoot, 'libs/content-astro/dist/templates', name),
  ] as const

  return candidates.find(existsSync) ?? candidates[0]
}

const readTemplate = (
  name: string
): Effect.Effect<string, PlatformError, FileSystem> =>
  FileSystem.pipe(
    Effect.flatMap((fileSystem) =>
      fileSystem.readFileString(templatePath(name))
    )
  )

const renderTemplate = <Context extends object>(
  name: string,
  context: Context
) =>
  readTemplate(name).pipe(
    Effect.map((source) =>
      Handlebars.compile<Context>(source, {
        noEscape: true,
        strict: true,
      })(context)
    )
  )

export const renderGeneratedModuleTemplate = (
  context: ContentGeneratedTemplateContext
) => renderTemplate('content-generated.ts.hbs-template', context)

export const renderRuntimeModuleTemplate = (
  context: ContentRuntimeTemplateContext
) => renderTemplate('content-runtime.ts.hbs-template', context)

export const renderRegistryModuleTemplate = (
  context: ContentRegistryTemplateContext
) =>
  renderTemplate(
    'content-registry.ts.hbs-template',
    registryTemplateContext(context)
  )
