import { readdir, readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import {
  type CompiledFactsRelease,
  compileFactsRelease,
} from '@cv/facts-release'
import { Effect } from 'effect'

import { FactsPublisherSourceError } from './errors'

type SourceProvenance = {
  readonly compilerCommit: string
  readonly compilerRepository: string
  readonly sourceCommit: string
  readonly sourceRepository: string
}

type AssetDescriptor = {
  readonly id: string
}

const record = (
  value: unknown
): Readonly<Record<string, unknown>> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined

const assetDescriptors = (
  catalogue: unknown
): Effect.Effect<readonly AssetDescriptor[], FactsPublisherSourceError> => {
  const assets = record(catalogue)?.assets
  if (!Array.isArray(assets)) {
    return Effect.fail(
      new FactsPublisherSourceError({
        cause: new Error('The catalogue has no asset array.'),
        message: 'The facts catalogue asset list is invalid.',
        operation: 'resolve-assets',
      })
    )
  }

  const descriptors: AssetDescriptor[] = []
  for (const value of assets) {
    const id = record(value)?.id
    if (typeof id !== 'string' || id.length === 0) {
      return Effect.fail(
        new FactsPublisherSourceError({
          cause: new Error('A facts asset has no identifier.'),
          message: 'The facts catalogue contains an invalid asset descriptor.',
          operation: 'resolve-assets',
        })
      )
    }
    descriptors.push({ id })
  }
  return Effect.succeed(descriptors)
}

const readCatalogue = (contentRoot: string) =>
  Effect.tryPromise({
    try: () => readFile(resolve(contentRoot, 'facts/catalogue.json'), 'utf8'),
    catch: (cause) =>
      new FactsPublisherSourceError({
        cause,
        message:
          'Could not read facts/catalogue.json from the source checkout.',
        operation: 'read-catalogue',
      }),
  }).pipe(
    Effect.flatMap((source) =>
      Effect.try({
        try: () => JSON.parse(source) as unknown,
        catch: (cause) =>
          new FactsPublisherSourceError({
            cause,
            message: 'facts/catalogue.json is not valid JSON.',
            operation: 'parse-catalogue',
          }),
      })
    )
  )

const readAssetFiles = (contentRoot: string) =>
  Effect.tryPromise({
    try: () =>
      readdir(resolve(contentRoot, 'facts/assets'), { withFileTypes: true }),
    catch: (cause) =>
      new FactsPublisherSourceError({
        cause,
        message: 'Could not read the reviewed facts asset directory.',
        operation: 'read-assets',
      }),
  }).pipe(
    Effect.flatMap((entries) => {
      const invalid = entries.find((entry) => !entry.isFile())
      return invalid
        ? Effect.fail(
            new FactsPublisherSourceError({
              cause: new Error(`Unexpected asset entry: ${invalid.name}`),
              message: 'The facts asset directory may contain files only.',
              operation: 'resolve-assets',
            })
          )
        : Effect.succeed(entries.map(({ name }) => name).sort())
    })
  )

const resolveAssetSources = (
  contentRoot: string,
  descriptors: readonly AssetDescriptor[],
  files: readonly string[]
) =>
  Effect.gen(function* () {
    const expected = new Set<string>()
    const sources = yield* Effect.forEach(descriptors, (descriptor) => {
      const matches = files.filter((file) =>
        file.startsWith(`${descriptor.id}.`)
      )
      if (matches.length !== 1) {
        return Effect.fail(
          new FactsPublisherSourceError({
            cause: new Error(
              `Expected one file prefixed with ${descriptor.id}, found ${matches.length}.`
            ),
            message: `Could not uniquely resolve reviewed asset ${descriptor.id}.`,
            operation: 'resolve-assets',
          })
        )
      }
      const fileName = matches[0]
      if (!fileName) {
        return Effect.fail(
          new FactsPublisherSourceError({
            cause: new Error('Resolved facts asset disappeared.'),
            message: `Could not resolve reviewed asset ${descriptor.id}.`,
            operation: 'resolve-assets',
          })
        )
      }
      expected.add(fileName)
      return Effect.tryPromise({
        try: () => readFile(resolve(contentRoot, 'facts/assets', fileName)),
        catch: (cause) =>
          new FactsPublisherSourceError({
            cause,
            message: `Could not read reviewed asset ${descriptor.id}.`,
            operation: 'read-assets',
          }),
      }).pipe(
        Effect.map((bytes) => ({
          bytes: new Uint8Array(bytes),
          fileName: basename(fileName),
          id: descriptor.id,
        }))
      )
    })

    const unexpected = files.find((file) => !expected.has(file))
    if (unexpected) {
      return yield* new FactsPublisherSourceError({
        cause: new Error(`Unexpected facts asset: ${unexpected}`),
        message: 'The facts asset directory contains an undeclared file.',
        operation: 'resolve-assets',
      })
    }
    return sources
  })

export const compileFactsCheckout = Effect.fn('FactsPublisher.compileCheckout')(
  (
    contentRoot: string,
    provenance: SourceProvenance
  ): Effect.Effect<
    CompiledFactsRelease,
    | FactsPublisherSourceError
    | import('@cv/facts-release').FactsReleaseAssetError
    | import('@cv/facts-release').FactsReleaseHashError
    | import('@cv/facts-release').FactsReleaseValidationError
  > =>
    Effect.gen(function* () {
      const catalogue = yield* readCatalogue(contentRoot)
      const descriptors = yield* assetDescriptors(catalogue)
      const files =
        descriptors.length === 0 ? [] : yield* readAssetFiles(contentRoot)
      const assets = yield* resolveAssetSources(contentRoot, descriptors, files)
      return yield* compileFactsRelease({
        assets,
        catalogue,
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
