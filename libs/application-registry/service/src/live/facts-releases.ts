import {
  type ArtifactMetadata,
  ArtifactStore,
} from '@cv/application-registry-artifact-store'
import { FactsReleasesCrud } from '@cv/application-registry-crud'
import type {
  FactsRelease,
  FactsReleaseAsset,
  FactsReleaseCatalog,
} from '@cv/application-registry-entity'
import { Effect, Layer, Option } from 'effect'

import {
  type FactsReleaseObjectKind,
  FactsReleaseObjectMetadataError,
  FactsReleaseObjectNotFoundError,
  RegistryArtifactError,
  RegistryBadRequestError,
  RegistryConflictError,
  RegistryNotFoundError,
} from '../errors'
import { requireNonEmpty } from '../internal/opaque-content'
import { missingRegistryData, registryNow } from '../internal/shared'
import {
  FactsReleasesService,
  type FactsReleasesService as FactsReleasesServiceShape,
} from '../services/facts-releases'
import type {
  ActiveFactsRelease,
  FactsReleaseRecord,
  RegisterFactsReleaseInput,
} from '../types'

type ObjectReference = {
  readonly byteLength: number
  readonly key: string
  readonly logicalId: string
  readonly objectKind: FactsReleaseObjectKind
  readonly releaseId: string
  readonly sha256: string
}

const referenceForManifest = (release: FactsRelease): ObjectReference => ({
  byteLength: release.manifestByteLength,
  key: release.manifestObjectKey,
  logicalId: release.id,
  objectKind: 'manifest',
  releaseId: release.id,
  sha256: release.manifestSha256,
})

const referenceForCatalog = (
  catalog: FactsReleaseCatalog
): ObjectReference => ({
  byteLength: catalog.byteLength,
  key: catalog.objectKey,
  logicalId: catalog.locale,
  objectKind: 'catalog',
  releaseId: catalog.releaseId,
  sha256: catalog.sha256,
})

const referenceForAsset = (asset: FactsReleaseAsset): ObjectReference => ({
  byteLength: asset.byteLength,
  key: asset.objectKey,
  logicalId: asset.assetId,
  objectKind: 'asset',
  releaseId: asset.releaseId,
  sha256: asset.sha256,
})

const metadataMismatch = (
  reference: ObjectReference,
  field: 'byteLength' | 'key' | 'sha256',
  expected: number | string,
  actual: number | string
) =>
  new FactsReleaseObjectMetadataError({
    actual,
    expected,
    field,
    logicalId: reference.logicalId,
    message: `Facts release ${reference.objectKind} ${reference.logicalId} has inconsistent ${field} metadata.`,
    objectKind: reference.objectKind,
    releaseId: reference.releaseId,
  })

const verifyMetadata = (
  reference: ObjectReference,
  metadata: ArtifactMetadata
) => {
  if (metadata.sha256 !== reference.sha256) {
    return Effect.fail(
      metadataMismatch(reference, 'sha256', reference.sha256, metadata.sha256)
    )
  }
  if (metadata.key !== reference.key) {
    return Effect.fail(
      metadataMismatch(reference, 'key', reference.key, metadata.key)
    )
  }
  if (metadata.byteLength !== reference.byteLength) {
    return Effect.fail(
      metadataMismatch(
        reference,
        'byteLength',
        reference.byteLength,
        metadata.byteLength
      )
    )
  }
  return Effect.void
}

const validateReference = (reference: ObjectReference) =>
  Effect.gen(function* () {
    yield* requireNonEmpty(reference.releaseId, 'Facts release ID')
    yield* requireNonEmpty(reference.logicalId, 'Facts object logical ID')
    yield* requireNonEmpty(reference.key, 'Facts object key')
    yield* requireNonEmpty(reference.sha256, 'Facts object SHA-256')
    if (
      !Number.isSafeInteger(reference.byteLength) ||
      reference.byteLength < 0
    ) {
      return yield* new RegistryBadRequestError({
        message: `Facts release ${reference.objectKind} ${reference.logicalId} has an invalid byte length.`,
      })
    }
  })

const findDuplicate = (values: readonly string[]) => {
  const seen = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) return value
    seen.add(value)
  }
  return undefined
}

const validateRegistration = (input: RegisterFactsReleaseInput) =>
  Effect.gen(function* () {
    const releaseId = yield* requireNonEmpty(
      input.release.id,
      'Facts release ID'
    )
    yield* requireNonEmpty(
      input.release.factsSchemaVersion,
      'Facts schema version'
    )
    yield* requireNonEmpty(
      input.release.sourceRepository,
      'Facts source repository'
    )
    yield* requireNonEmpty(input.release.sourceCommit, 'Facts source commit')
    yield* requireNonEmpty(
      input.release.compilerRepository,
      'Facts compiler repository'
    )
    yield* requireNonEmpty(
      input.release.compilerCommit,
      'Facts compiler commit'
    )
    if (input.catalogs.length === 0) {
      return yield* new RegistryBadRequestError({
        message: 'A facts release must contain at least one locale catalog.',
      })
    }

    for (const catalog of input.catalogs) {
      if (catalog.releaseId !== releaseId) {
        return yield* new RegistryBadRequestError({
          message: `Facts catalog ${catalog.locale} belongs to release ${catalog.releaseId}, not ${releaseId}.`,
        })
      }
      yield* requireNonEmpty(catalog.locale, 'Facts catalog locale')
      yield* requireNonEmpty(catalog.mediaType, 'Facts catalog media type')
    }
    for (const asset of input.assets) {
      if (asset.releaseId !== releaseId) {
        return yield* new RegistryBadRequestError({
          message: `Facts asset ${asset.assetId} belongs to release ${asset.releaseId}, not ${releaseId}.`,
        })
      }
      yield* requireNonEmpty(asset.assetId, 'Facts asset ID')
      yield* requireNonEmpty(asset.fileName, 'Facts asset file name')
      yield* requireNonEmpty(asset.mediaType, 'Facts asset media type')
    }

    const duplicateLocale = findDuplicate(
      input.catalogs.map(({ locale }) => locale)
    )
    if (duplicateLocale) {
      return yield* new RegistryBadRequestError({
        message: `Facts release ${releaseId} contains duplicate locale ${duplicateLocale}.`,
      })
    }
    const duplicateAsset = findDuplicate(
      input.assets.map(({ assetId }) => assetId)
    )
    if (duplicateAsset) {
      return yield* new RegistryBadRequestError({
        message: `Facts release ${releaseId} contains duplicate asset ${duplicateAsset}.`,
      })
    }

    const references = [
      referenceForManifest(input.release),
      ...input.catalogs.map(referenceForCatalog),
      ...input.assets.map(referenceForAsset),
    ]
    yield* Effect.forEach(references, validateReference, { discard: true })
    return references
  })

const releaseEquals = (left: FactsRelease, right: FactsRelease) =>
  left.id === right.id &&
  left.factsSchemaVersion === right.factsSchemaVersion &&
  left.sourceRepository === right.sourceRepository &&
  left.sourceCommit === right.sourceCommit &&
  left.compilerRepository === right.compilerRepository &&
  left.compilerCommit === right.compilerCommit &&
  left.manifestObjectKey === right.manifestObjectKey &&
  left.manifestSha256 === right.manifestSha256 &&
  left.manifestByteLength === right.manifestByteLength &&
  left.createdAt === right.createdAt

const catalogEquals = (left: FactsReleaseCatalog, right: FactsReleaseCatalog) =>
  left.releaseId === right.releaseId &&
  left.locale === right.locale &&
  left.objectKey === right.objectKey &&
  left.sha256 === right.sha256 &&
  left.byteLength === right.byteLength &&
  left.mediaType === right.mediaType

const assetEquals = (left: FactsReleaseAsset, right: FactsReleaseAsset) =>
  left.releaseId === right.releaseId &&
  left.assetId === right.assetId &&
  left.fileName === right.fileName &&
  left.objectKey === right.objectKey &&
  left.sha256 === right.sha256 &&
  left.byteLength === right.byteLength &&
  left.mediaType === right.mediaType

const recordsEqual = (left: FactsReleaseRecord, right: FactsReleaseRecord) => {
  if (
    !releaseEquals(left.release, right.release) ||
    left.catalogs.length !== right.catalogs.length ||
    left.assets.length !== right.assets.length
  ) {
    return false
  }

  const rightCatalogs = new Map(
    right.catalogs.map((catalog) => [catalog.locale, catalog])
  )
  const rightAssets = new Map(
    right.assets.map((asset) => [asset.assetId, asset])
  )
  return (
    left.catalogs.every((catalog) => {
      const other = rightCatalogs.get(catalog.locale)
      return other !== undefined && catalogEquals(catalog, other)
    }) &&
    left.assets.every((asset) => {
      const other = rightAssets.get(asset.assetId)
      return other !== undefined && assetEquals(asset, other)
    })
  )
}

const make = Effect.gen(function* () {
  const crud = yield* FactsReleasesCrud
  const store = yield* ArtifactStore

  const loadRecord = Effect.fn('FactsReleasesService.loadRecord')(
    (releaseId: string) =>
      Effect.gen(function* () {
        const release = yield* crud.find(releaseId)
        if (!release) {
          return yield* new RegistryNotFoundError({
            identifier: releaseId,
            message: `Facts release not found: ${releaseId}`,
          })
        }
        const [catalogs, assets] = yield* Effect.all([
          crud.catalogs(release.id),
          crud.assets(release.id),
        ])
        return { assets, catalogs, release } satisfies FactsReleaseRecord
      })
  )

  const verifyReference = Effect.fn('FactsReleasesService.verifyReference')(
    (reference: ObjectReference) =>
      Effect.gen(function* () {
        const found = yield* store.head(reference.sha256).pipe(
          Effect.mapError(
            (cause) =>
              new RegistryArtifactError({
                cause,
                message: `Could not verify facts release ${reference.objectKind} ${reference.logicalId}.`,
                operation: 'verify',
              })
          )
        )
        if (Option.isNone(found)) {
          return yield* new FactsReleaseObjectNotFoundError({
            logicalId: reference.logicalId,
            message: `Facts release ${reference.objectKind} ${reference.logicalId} is not present in object storage.`,
            objectKind: reference.objectKind,
            releaseId: reference.releaseId,
            sha256: reference.sha256,
          })
        }
        yield* verifyMetadata(reference, found.value)
      })
  )

  const readReference = Effect.fn('FactsReleasesService.readReference')(
    (reference: ObjectReference) =>
      Effect.gen(function* () {
        yield* verifyReference(reference)
        const bytes = yield* store.read(reference.sha256).pipe(
          Effect.mapError(
            (cause) =>
              new RegistryArtifactError({
                cause,
                message: `Could not read facts release ${reference.objectKind} ${reference.logicalId}.`,
                operation: 'read',
              })
          )
        )
        if (bytes.byteLength !== reference.byteLength) {
          return yield* metadataMismatch(
            reference,
            'byteLength',
            reference.byteLength,
            bytes.byteLength
          )
        }
        return bytes.slice()
      })
  )

  const findActive = Effect.fn('FactsReleasesService.findActive')(
    (channel: string, locale: string) =>
      Effect.gen(function* () {
        const channelName = yield* requireNonEmpty(channel, 'Facts channel')
        const localeName = yield* requireNonEmpty(locale, 'Facts locale')
        const active = yield* crud.findActiveCatalog(channelName, localeName)
        if (!active) {
          return yield* new RegistryNotFoundError({
            identifier: `${channelName}:${localeName}`,
            message: `No active facts release exists for channel ${channelName} and locale ${localeName}.`,
          })
        }
        const [assets, catalogs] = yield* Effect.all([
          crud.assets(active.release.id),
          crud.catalogs(active.release.id),
        ])
        return { ...active, assets, catalogs } satisfies ActiveFactsRelease
      })
  )

  const readActiveCatalog = Effect.fn('FactsReleasesService.readActiveCatalog')(
    (channel: string, locale: string) =>
      Effect.gen(function* () {
        const active = yield* findActive(channel, locale)
        const catalogBytes = yield* readReference(
          referenceForCatalog(active.catalog)
        )
        return { ...active, catalogBytes }
      })
  )

  return {
    activate: Effect.fn('FactsReleasesService.activate')(
      (channel: string, releaseId: string, expectedVersion: number) =>
        Effect.gen(function* () {
          const channelName = yield* requireNonEmpty(channel, 'Facts channel')
          const requestedReleaseId = yield* requireNonEmpty(
            releaseId,
            'Facts release ID'
          )
          if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) {
            return yield* new RegistryBadRequestError({
              message:
                'Expected facts channel version must be a non-negative safe integer.',
            })
          }

          const release = yield* loadRecord(requestedReleaseId)
          const locale = release.catalogs[0]?.locale
          if (!locale) {
            return yield* new RegistryBadRequestError({
              message: `Facts release ${requestedReleaseId} has no locale catalog.`,
            })
          }

          const current = yield* crud.findActiveCatalog(channelName, locale)
          if (
            (current === undefined && expectedVersion !== 0) ||
            (current !== undefined &&
              current.channel.version !== expectedVersion)
          ) {
            return yield* new RegistryConflictError({
              message: `Facts channel ${channelName} does not match expected version ${expectedVersion}.`,
            })
          }

          const activated = yield* crud.activate(
            channelName,
            requestedReleaseId,
            expectedVersion,
            yield* registryNow
          )
          if (!activated) {
            return yield* new RegistryConflictError({
              message: `Facts channel ${channelName} changed while release ${requestedReleaseId} was being activated.`,
            })
          }
          const active = yield* crud.findActiveCatalog(channelName, locale)
          if (!active || active.release.id !== requestedReleaseId) {
            return yield* missingRegistryData(
              `Activated facts channel ${channelName} could not be reloaded.`
            )
          }
          return active.channel
        })
    ),
    find: loadRecord,
    findActive,
    readActive: Effect.fn('FactsReleasesService.readActive')(
      (channel: string, locale: string) =>
        Effect.gen(function* () {
          const catalog = yield* readActiveCatalog(channel, locale)
          const assetContents = yield* Effect.forEach(
            catalog.assets,
            (asset) =>
              readReference(referenceForAsset(asset)).pipe(
                Effect.map((bytes) => ({ asset, bytes }))
              ),
            { concurrency: 'unbounded' }
          )
          return { ...catalog, assetContents }
        })
    ),
    readActiveAsset: Effect.fn('FactsReleasesService.readActiveAsset')(
      (channel: string, locale: string, assetId: string) =>
        Effect.gen(function* () {
          const active = yield* findActive(channel, locale)
          const requestedAssetId = yield* requireNonEmpty(
            assetId,
            'Facts asset ID'
          )
          const asset = active.assets.find(
            (candidate) => candidate.assetId === requestedAssetId
          )
          if (!asset) {
            return yield* new RegistryNotFoundError({
              identifier: `${active.release.id}:${requestedAssetId}`,
              message: `Facts asset ${requestedAssetId} is not part of active release ${active.release.id}.`,
            })
          }
          const bytes = yield* readReference(referenceForAsset(asset))
          return { ...active, asset, bytes }
        })
    ),
    readActiveCatalog,
    register: Effect.fn('FactsReleasesService.register')(
      (input: RegisterFactsReleaseInput) =>
        Effect.gen(function* () {
          const references = yield* validateRegistration(input)
          yield* Effect.forEach(references, verifyReference, { discard: true })

          const existingRelease = yield* crud.find(input.release.id)
          if (existingRelease) {
            const existing = yield* loadRecord(input.release.id)
            if (!recordsEqual(existing, input)) {
              return yield* new RegistryConflictError({
                message: `Facts release ${input.release.id} is already registered with different immutable metadata.`,
              })
            }
            return existing
          }

          yield* crud.register(input)
          const stored = yield* loadRecord(input.release.id)
          if (!recordsEqual(stored, input)) {
            return yield* new RegistryConflictError({
              message: `Facts release ${input.release.id} changed while it was being registered.`,
            })
          }
          return stored
        })
    ),
  } satisfies FactsReleasesServiceShape
})

export const FactsReleasesServiceLive = Layer.effect(FactsReleasesService, make)
