import { existsSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { Effect, Option } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { Path } from 'effect/Path'
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
  readonly contentRoot: string
}

type ContentRegistryTemplateRenderContext = ContentRegistryTemplateContext & {
  readonly mdxEntries: string
  readonly mdxImports: string
  readonly moduleEntries: string
  readonly moduleImports: string
}

const normalizeGlobPath = (path: string) => path.replaceAll('\\', '/')

const contentSourceExtensions = ['.tsx', '.ts', '.jsx', '.js', '.mdx'] as const
const contentRootModuleExtensions = ['.tsx', '.ts', '.jsx', '.js'] as const
const registryContentDirectory = 'content'
const registryRootModuleNames = ['content.config'] as const
const ignoredContentDirectoryNames = new Set([
  '.direnv',
  '.git',
  'coverage',
  'dist',
  'node_modules',
])

const isContentSourceFile = (path: string) =>
  contentSourceExtensions.some((extension) => path.endsWith(extension)) &&
  !path.endsWith('.d.ts')

const isIgnoredContentDirectory = (name: string) =>
  name.startsWith('.') || ignoredContentDirectoryNames.has(name)

const listContentSourceFiles = (directory: string): string[] =>
  existsSync(directory)
    ? readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const entryPath = join(directory, entry.name)

        if (entry.isDirectory()) {
          return isIgnoredContentDirectory(entry.name)
            ? []
            : listContentSourceFiles(entryPath)
        }

        return entry.isFile() && isContentSourceFile(entryPath)
          ? [entryPath]
          : []
      })
    : []

const listRootContentModules = (contentRoot: string) =>
  registryRootModuleNames.flatMap((moduleName) =>
    contentRootModuleExtensions
      .map((extension) => join(contentRoot, `${moduleName}${extension}`))
      .filter(existsSync)
  )

const listRegistrySourceFiles = (contentRoot: string) =>
  [
    ...listRootContentModules(contentRoot),
    ...listContentSourceFiles(join(contentRoot, registryContentDirectory)),
  ].sort((left, right) =>
    relative(contentRoot, left).localeCompare(relative(contentRoot, right))
  )

const viteFileImportPath = (path: string) => {
  const normalized = normalizeGlobPath(path)

  return normalized.startsWith('/') ? `/@fs${normalized}` : normalized
}

const registryEntries = (files: readonly string[], prefix: string) =>
  files
    .map(
      (file, index) =>
        `${JSON.stringify(viteFileImportPath(file))}: ${prefix}${index}`
    )
    .join(',\n    ')

const registryImports = (files: readonly string[], prefix: string) =>
  files
    .map(
      (file, index) =>
        `import * as ${prefix}${index} from ${JSON.stringify(
          viteFileImportPath(file)
        )}`
    )
    .join('\n')

const contentRegistryTemplateContext = ({
  contentRoot,
}: ContentRegistryTemplateContext): ContentRegistryTemplateRenderContext => {
  const files = listRegistrySourceFiles(contentRoot)
  const mdxFiles = files.filter((file) => file.endsWith('.mdx'))
  const moduleFiles = files.filter((file) => !file.endsWith('.mdx'))

  return {
    contentRoot,
    mdxEntries: registryEntries(mdxFiles, 'mdxModule'),
    mdxImports: registryImports(mdxFiles, 'mdxModule'),
    moduleEntries: registryEntries(moduleFiles, 'contentModule'),
    moduleImports: registryImports(moduleFiles, 'contentModule'),
  }
}

const templatePathCandidates = (name: string) =>
  Path.pipe(
    Effect.map(
      (path) =>
        [
          path.resolve(
            workspaceRoot,
            'libs/content-astro/dist/templates',
            name
          ),
          path.resolve(workspaceRoot, 'libs/content-astro/templates', name),
        ] as const
    )
  )

const templatePath = (name: string) =>
  Effect.all([FileSystem, templatePathCandidates(name)]).pipe(
    Effect.flatMap(([fileSystem, candidates]) =>
      Effect.findFirst(candidates, (candidate) =>
        fileSystem.exists(candidate)
      ).pipe(Effect.map(Option.getOrElse(() => candidates[0])))
    )
  )

const readTemplate = (
  name: string
): Effect.Effect<string, PlatformError, FileSystem | Path> =>
  templatePath(name).pipe(
    Effect.flatMap((path) =>
      FileSystem.pipe(
        Effect.flatMap((fileSystem) => fileSystem.readFileString(path))
      )
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
    contentRegistryTemplateContext(context)
  )
