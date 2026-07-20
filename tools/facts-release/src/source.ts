import {
  composeDecodedFactsRepository,
  decodeFactAssetRegistry,
  decodeFactEvidenceRegistry,
  decodeFactsRepositoryConfig,
  type FactAssetRegistrySource,
  type FactEvidenceRegistrySource,
  type FactsAuthoringCompositionError,
  type FactsAuthoringValidationError,
  type FactsRepositoryConfigSource,
  type FactsSectionModuleSource,
} from '@cv/facts-authoring'
import {
  type CompiledFactsRelease,
  compileFactsRelease,
  type FactsAssetSource,
  type FactsReleaseAssetError,
  type FactsReleaseHashError,
} from '@cv/facts-release'
import { Effect } from 'effect'
import {
  FileSystem,
  type FileSystem as FileSystemService,
} from 'effect/FileSystem'
import { Path, type Path as PathService } from 'effect/Path'
import { sortBy } from 'es-toolkit'
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
  readonly assets: FactAssetRegistrySource
  readonly config: FactsRepositoryConfigSource
  readonly evidence: FactEvidenceRegistrySource
  readonly sections: ReadonlyArray<FactsSectionModuleSource>
}

const sourceError = (
  operation: FactsPublisherSourceError['operation'],
  message: string,
  cause: unknown
) => new FactsPublisherSourceError({ cause, message, operation })

const loadSourceError = (message: string) => (cause: unknown) =>
  sourceError('load-source', message, cause)

const sourcePromise = <Value>(
  message: string,
  evaluate: () => Promise<Value>
) =>
  Effect.tryPromise({
    try: evaluate,
    catch: loadSourceError(message),
  })

const assertWithinCheckout = (
  path: PathService,
  contentRoot: string,
  candidate: string
) => {
  const child = path.relative(contentRoot, candidate)
  if (
    child === '..' ||
    child.startsWith(`..${path.sep}`) ||
    path.isAbsolute(child)
  ) {
    return Effect.fail(
      sourceError(
        'load-source',
        `Authored path escapes the content checkout: ${candidate}`,
        candidate
      )
    )
  }
  return Effect.void
}

const viteModuleId = (absolutePath: string) =>
  `/@fs/${absolutePath.replaceAll('\\', '/')}`

const loadDefaultExport = (server: ViteDevServer, absolutePath: string) =>
  sourcePromise(`Could not load authored facts module ${absolutePath}.`, () =>
    server.ssrLoadModule(viteModuleId(absolutePath))
  ).pipe(
    Effect.flatMap((loaded) => {
      if (loaded === null || typeof loaded !== 'object') {
        return Effect.fail(
          sourceError(
            'load-source',
            `${absolutePath} did not evaluate to a module.`,
            loaded
          )
        )
      }
      const value = Reflect.get(loaded, 'default')
      return value === undefined
        ? Effect.fail(
            sourceError(
              'load-source',
              `${absolutePath} must have a default export.`,
              loaded
            )
          )
        : Effect.succeed(value as unknown)
    })
  )

const canonicalPathWithinCheckout = (
  fileSystem: FileSystemService,
  path: PathService,
  contentRoot: string,
  candidate: string
) =>
  Effect.gen(function* () {
    yield* assertWithinCheckout(path, contentRoot, candidate)
    const canonical = yield* fileSystem
      .realPath(candidate)
      .pipe(
        Effect.mapError(
          loadSourceError(`Could not resolve authored facts path ${candidate}.`)
        )
      )
    yield* assertWithinCheckout(path, contentRoot, canonical)
    return canonical
  })

const loadOptionalDefaultExport = (
  fileSystem: FileSystemService,
  path: PathService,
  server: ViteDevServer,
  contentRoot: string,
  absolutePath: string
) =>
  fileSystem.exists(absolutePath).pipe(
    Effect.mapError(
      loadSourceError(`Could not inspect authored facts path ${absolutePath}.`)
    ),
    Effect.flatMap((exists) =>
      exists
        ? canonicalPathWithinCheckout(
            fileSystem,
            path,
            contentRoot,
            absolutePath
          ).pipe(
            Effect.flatMap((canonical) => loadDefaultExport(server, canonical))
          )
        : Effect.succeed({} as const)
    )
  )

const collectSectionFiles = (
  fileSystem: FileSystemService,
  path: PathService,
  contentRoot: string,
  localeRoot: string
) =>
  Effect.gen(function* () {
    const entries = yield* fileSystem
      .readDirectory(localeRoot)
      .pipe(
        Effect.mapError(
          loadSourceError(
            `Could not read facts locale directory ${localeRoot}.`
          )
        )
      )
    const files: string[] = []
    for (const entry of entries.toSorted((left, right) =>
      left.localeCompare(right)
    )) {
      const absolutePath = path.join(localeRoot, entry)
      yield* canonicalPathWithinCheckout(
        fileSystem,
        path,
        contentRoot,
        absolutePath
      )
      const info = yield* fileSystem
        .stat(absolutePath)
        .pipe(
          Effect.mapError(
            loadSourceError(`Could not inspect facts section ${absolutePath}.`)
          )
        )
      if (info.type === 'Directory') {
        const indexPath = path.join(absolutePath, 'index.ts')
        const hasIndex = yield* fileSystem
          .exists(indexPath)
          .pipe(
            Effect.mapError(
              loadSourceError(`Could not inspect facts section ${indexPath}.`)
            )
          )
        if (hasIndex) {
          yield* canonicalPathWithinCheckout(
            fileSystem,
            path,
            contentRoot,
            indexPath
          )
          files.push(indexPath)
        }
        continue
      }
      if (
        info.type === 'File' &&
        entry.endsWith('.ts') &&
        !entry.endsWith('.d.ts')
      ) {
        files.push(absolutePath)
      }
    }
    return files
  })

const loadSections = (
  fileSystem: FileSystemService,
  path: PathService,
  server: ViteDevServer,
  contentRoot: string,
  factsRoot: string,
  config: FactsRepositoryConfigSource
) =>
  Effect.gen(function* () {
    const sections: FactsSectionModuleSource[] = []
    for (const locale of config.locales) {
      const localeRoot = path.resolve(factsRoot, locale)
      yield* canonicalPathWithinCheckout(
        fileSystem,
        path,
        contentRoot,
        localeRoot
      )
      const sectionFiles = yield* collectSectionFiles(
        fileSystem,
        path,
        contentRoot,
        localeRoot
      )
      for (const absolutePath of sectionFiles) {
        sections.push({
          locale,
          relativePath: path
            .relative(contentRoot, absolutePath)
            .replaceAll('\\', '/'),
          value: yield* loadDefaultExport(server, absolutePath),
        })
      }
    }
    return sections
  })

const sha256 = (bytes: Uint8Array) =>
  sourcePromise('Could not hash a declared facts asset.', async () => {
    const digest = await crypto.subtle.digest('SHA-256', bytes.slice())
    return Buffer.from(digest).toString('hex')
  })

const loadAssets = (
  fileSystem: FileSystemService,
  path: PathService,
  contentRoot: string,
  factsRoot: string,
  assets: FactAssetRegistrySource
) =>
  Effect.gen(function* () {
    const assetRoot = path.resolve(factsRoot, 'assets')
    const digests: Record<string, string> = {}
    const sources: FactsAssetSource[] = []
    const files = new Map<
      string,
      { readonly bytes: Uint8Array; readonly sha256: string }
    >()
    for (const [id, asset] of sortBy(Object.entries(assets), [
      ([key]) => key,
    ])) {
      const cached = files.get(asset.fileName)
      const assetPath = path.resolve(assetRoot, asset.fileName)
      const canonical = yield* canonicalPathWithinCheckout(
        fileSystem,
        path,
        contentRoot,
        assetPath
      )
      const bytes =
        cached?.bytes ??
        (yield* fileSystem
          .readFile(canonical)
          .pipe(
            Effect.mapError(
              loadSourceError(`Could not read declared facts asset ${id}.`)
            )
          ))
      const digest = cached?.sha256 ?? (yield* sha256(bytes))
      files.set(asset.fileName, { bytes, sha256: digest })
      digests[id] = digest
      sources.push({ bytes, fileName: asset.fileName, id, sha256: digest })
    }
    return { digests, sources }
  })

const loadFactsSource = Effect.fn('FactsPublisher.loadSource')(
  (contentRoot: string) =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem
      const path = yield* Path
      return yield* Effect.scoped(
        Effect.gen(function* () {
          const checkoutRoot = yield* fileSystem
            .realPath(path.resolve(contentRoot))
            .pipe(
              Effect.mapError(
                loadSourceError(
                  `Could not resolve the facts checkout ${contentRoot}.`
                )
              )
            )
          const cacheRoot = yield* fileSystem
            .makeTempDirectoryScoped({ prefix: 'cv-facts-vite-' })
            .pipe(
              Effect.mapError(
                loadSourceError('Could not create the Vite cache directory.')
              )
            )
          return yield* Effect.acquireUseRelease(
            sourcePromise('Could not start the facts module loader.', () =>
              createServer({
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
            ),
            (server) =>
              Effect.gen(function* () {
                const configPath = path.resolve(checkoutRoot, 'facts.config.ts')
                const canonicalConfigPath = yield* canonicalPathWithinCheckout(
                  fileSystem,
                  path,
                  checkoutRoot,
                  configPath
                )
                const configSource = yield* loadDefaultExport(
                  server,
                  canonicalConfigPath
                )
                const config = yield* decodeFactsRepositoryConfig(configSource)
                const factsRoot = path.resolve(checkoutRoot, config.factsDir)
                const canonicalFactsRoot = yield* canonicalPathWithinCheckout(
                  fileSystem,
                  path,
                  checkoutRoot,
                  factsRoot
                )
                const evidenceSource = yield* loadOptionalDefaultExport(
                  fileSystem,
                  path,
                  server,
                  checkoutRoot,
                  path.resolve(canonicalFactsRoot, 'evidence.ts')
                )
                const assetSource = yield* loadOptionalDefaultExport(
                  fileSystem,
                  path,
                  server,
                  checkoutRoot,
                  path.resolve(canonicalFactsRoot, 'assets.ts')
                )
                const evidence = yield* decodeFactEvidenceRegistry(
                  evidenceSource,
                  `${config.factsDir}/evidence.ts`
                )
                const assets = yield* decodeFactAssetRegistry(
                  assetSource,
                  `${config.factsDir}/assets.ts`
                )
                const sections = yield* loadSections(
                  fileSystem,
                  path,
                  server,
                  checkoutRoot,
                  canonicalFactsRoot,
                  config
                )
                const loadedAssets = yield* loadAssets(
                  fileSystem,
                  path,
                  checkoutRoot,
                  canonicalFactsRoot,
                  assets
                )
                return {
                  assetDigests: loadedAssets.digests,
                  assetSources: loadedAssets.sources,
                  assets,
                  config,
                  evidence,
                  sections,
                } satisfies LoadedFactsSource
              }),
            (server) =>
              sourcePromise('Could not close the facts module loader.', () =>
                server.close()
              )
          )
        })
      )
    })
)

export const compileFactsCheckout = Effect.fn('FactsPublisher.compileCheckout')(
  (
    contentRoot: string,
    provenance: SourceProvenance
  ): Effect.Effect<
    CompiledFactsRelease,
    | FactsAuthoringCompositionError
    | FactsAuthoringValidationError
    | FactsPublisherSourceError
    | FactsReleaseAssetError
    | FactsReleaseHashError,
    FileSystemService | PathService
  > =>
    Effect.gen(function* () {
      const loaded = yield* loadFactsSource(contentRoot)
      const compilation = yield* composeDecodedFactsRepository({
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
