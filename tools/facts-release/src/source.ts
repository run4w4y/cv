import { access, mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path'
import {
  composeFactsRepository,
  decodeFactsRepositoryConfig,
  FactAssetRegistrySourceSchema,
  type FactsAuthoringCompositionError,
  type FactsAuthoringValidationError,
  type FactsRepositoryConfigSource,
  type FactsSectionModuleSource,
} from '@cv/facts-authoring'
import {
  type CompiledFactsRelease,
  compileFactsRelease,
  type FactsAssetSource,
} from '@cv/facts-release'
import { Effect, Schema } from 'effect'
import { createServer, type ViteDevServer } from 'vite'

import { FactsPublisherSourceError } from './errors'

type SourceProvenance = {
  readonly compilerCommit: string
  readonly compilerRepository: string
  readonly sourceCommit: string
  readonly sourceRepository: string
}

type LoadedFactsSource = {
  readonly assetDigests: Readonly<Record<string, string>>
  readonly assetSources: ReadonlyArray<FactsAssetSource>
  readonly assets: unknown
  readonly config: unknown
  readonly evidence: unknown
  readonly sections: ReadonlyArray<FactsSectionModuleSource>
}

const sourceError = (
  operation: FactsPublisherSourceError['operation'],
  message: string,
  cause: unknown
) => new FactsPublisherSourceError({ cause, message, operation })

const exists = async (path: string) => {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

const assertWithinCheckout = (contentRoot: string, candidate: string) => {
  const child = relative(contentRoot, candidate)
  if (child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child)) {
    throw new Error(`Authored path escapes the content checkout: ${candidate}`)
  }
}

const viteModuleId = (absolutePath: string) =>
  `/@fs/${absolutePath.replaceAll('\\', '/')}`

const loadDefaultExport = async (
  server: ViteDevServer,
  absolutePath: string
) => {
  const loaded: unknown = await server.ssrLoadModule(viteModuleId(absolutePath))
  if (loaded === null || typeof loaded !== 'object') {
    throw new Error(`${absolutePath} did not evaluate to a module.`)
  }
  const value = Reflect.get(loaded, 'default')
  if (value === undefined) {
    throw new Error(`${absolutePath} must have a default export.`)
  }
  return value as unknown
}

const loadOptionalDefaultExport = async (
  server: ViteDevServer,
  absolutePath: string
) =>
  (await exists(absolutePath))
    ? loadDefaultExport(server, absolutePath)
    : ({} as const)

const collectSectionFiles = async (
  localeRoot: string
): Promise<ReadonlyArray<string>> => {
  const entries = await readdir(localeRoot, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries.sort((left, right) =>
    left.name.localeCompare(right.name)
  )) {
    const absolutePath = join(localeRoot, entry.name)
    if (entry.isDirectory()) {
      const indexPath = join(absolutePath, 'index.ts')
      if (!(await exists(indexPath))) {
        throw new Error(
          `Facts section directory must expose index.ts: ${absolutePath}`
        )
      }
      files.push(indexPath)
      continue
    }
    if (
      !entry.isFile() ||
      !entry.name.endsWith('.ts') ||
      entry.name.endsWith('.d.ts')
    ) {
      throw new Error(
        `Locale facts may contain section.ts files or section/index.ts directories only: ${absolutePath}`
      )
    }
    files.push(absolutePath)
  }
  return files
}

const loadSections = async (
  server: ViteDevServer,
  contentRoot: string,
  factsRoot: string,
  config: FactsRepositoryConfigSource
) => {
  const sections: FactsSectionModuleSource[] = []
  for (const locale of config.locales) {
    const localeRoot = resolve(factsRoot, locale)
    assertWithinCheckout(contentRoot, localeRoot)
    for (const absolutePath of await collectSectionFiles(localeRoot)) {
      sections.push({
        locale,
        relativePath: relative(contentRoot, absolutePath).replaceAll('\\', '/'),
        value: await loadDefaultExport(server, absolutePath),
      })
    }
  }
  return sections
}

const sha256 = async (bytes: Uint8Array) => {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice())
  return Buffer.from(digest).toString('hex')
}

const loadAssets = async (
  factsRoot: string,
  authoredAssets: unknown
): Promise<{
  readonly digests: Readonly<Record<string, string>>
  readonly sources: ReadonlyArray<FactsAssetSource>
}> => {
  const assets = await Effect.runPromise(
    Schema.decodeUnknownEffect(FactAssetRegistrySourceSchema)(authoredAssets)
  )
  const assetRoot = resolve(factsRoot, 'assets')
  const entries = (await exists(assetRoot))
    ? await readdir(assetRoot, { withFileTypes: true })
    : []
  const files = entries.map((entry) => {
    if (!entry.isFile()) {
      throw new Error(`Unexpected entry in facts/assets: ${entry.name}`)
    }
    return entry.name
  })
  const expectedFiles = new Set<string>()
  const digests: Record<string, string> = {}
  const sources: FactsAssetSource[] = []
  for (const [id, asset] of Object.entries(assets).sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    if (basename(asset.fileName) !== asset.fileName) {
      throw new Error(`Asset ${id} must use a flat, safe file name.`)
    }
    if (expectedFiles.has(asset.fileName)) {
      throw new Error(
        `Asset file ${asset.fileName} is declared more than once.`
      )
    }
    expectedFiles.add(asset.fileName)
    const bytes = new Uint8Array(
      await readFile(resolve(assetRoot, asset.fileName))
    )
    digests[id] = await sha256(bytes)
    sources.push({ bytes, fileName: asset.fileName, id })
  }
  const unexpected = files.find((file) => !expectedFiles.has(file))
  if (unexpected) {
    throw new Error(`Undeclared facts asset: ${unexpected}`)
  }
  return { digests, sources }
}

const assertFactsRootShape = async (
  factsRoot: string,
  config: FactsRepositoryConfigSource
) => {
  const allowed = new Set([
    'assets',
    'assets.ts',
    'evidence.ts',
    ...config.locales,
  ])
  const entries = await readdir(factsRoot, { withFileTypes: true })
  const unexpected = entries.find((entry) => !allowed.has(entry.name))
  if (unexpected) {
    throw new Error(
      `Unexpected facts source entry not declared by facts.config.ts: ${unexpected.name}`
    )
  }
}

const loadFactsSource = async (
  contentRoot: string
): Promise<LoadedFactsSource> => {
  const checkoutRoot = resolve(contentRoot)
  const cacheRoot = await mkdtemp(join(tmpdir(), 'cv-facts-vite-'))
  const server = await createServer({
    appType: 'custom',
    cacheDir: cacheRoot,
    configFile: false,
    logLevel: 'silent',
    root: checkoutRoot,
    server: {
      fs: { allow: [checkoutRoot] },
      middlewareMode: true,
    },
  })
  try {
    const configPath = resolve(checkoutRoot, 'facts.config.ts')
    const configSource = await loadDefaultExport(server, configPath)
    const config = await Effect.runPromise(
      decodeFactsRepositoryConfig(configSource)
    )
    const factsRoot = resolve(checkoutRoot, config.factsDir)
    assertWithinCheckout(checkoutRoot, factsRoot)
    await assertFactsRootShape(factsRoot, config)
    const evidence = await loadOptionalDefaultExport(
      server,
      resolve(factsRoot, 'evidence.ts')
    )
    const assets = await loadOptionalDefaultExport(
      server,
      resolve(factsRoot, 'assets.ts')
    )
    const sections = await loadSections(server, checkoutRoot, factsRoot, config)
    const loadedAssets = await loadAssets(factsRoot, assets)
    return {
      assetDigests: loadedAssets.digests,
      assetSources: loadedAssets.sources,
      assets,
      config: configSource,
      evidence,
      sections,
    }
  } finally {
    await server.close()
    await rm(cacheRoot, { force: true, recursive: true })
  }
}

const loadFactsSourceEffect = (contentRoot: string) =>
  Effect.tryPromise({
    try: () => loadFactsSource(contentRoot),
    catch: (cause) =>
      sourceError(
        'load-source',
        'Could not load the TypeScript facts repository.',
        cause
      ),
  })

export const compileFactsCheckout = Effect.fn('FactsPublisher.compileCheckout')(
  (
    contentRoot: string,
    provenance: SourceProvenance
  ): Effect.Effect<
    CompiledFactsRelease,
    | FactsAuthoringCompositionError
    | FactsAuthoringValidationError
    | FactsPublisherSourceError
    | import('@cv/facts-release').FactsReleaseAssetError
    | import('@cv/facts-release').FactsReleaseHashError
    | import('@cv/facts-release').FactsReleaseValidationError
  > =>
    Effect.gen(function* () {
      const loaded = yield* loadFactsSourceEffect(contentRoot)
      const compilation = yield* composeFactsRepository({
        assetDigests: loaded.assetDigests,
        assets: loaded.assets,
        config: loaded.config,
        evidence: loaded.evidence,
        sections: loaded.sections,
      })
      return yield* compileFactsRelease({
        assets: loaded.assetSources,
        catalogues: compilation.catalogues,
        provenance: {
          compiler: {
            commit: provenance.compilerCommit,
            repository: provenance.compilerRepository,
          },
          source: {
            commit: provenance.sourceCommit,
            repository: provenance.sourceRepository,
          },
        },
      })
    })
)
