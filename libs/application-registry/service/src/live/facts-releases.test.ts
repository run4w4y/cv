import { describe, expect, test } from 'bun:test'
import {
  type ArtifactMetadata,
  ArtifactStore,
  ArtifactStoreHashError,
  ArtifactStoreNotFoundError,
  type ArtifactStoreShape,
} from '@cv/application-registry-artifact-store'
import {
  type ActiveFactsCatalog,
  FactsReleasesCrud,
  type FactsReleasesCrud as FactsReleasesCrudShape,
  type PersistedFactsRelease,
} from '@cv/application-registry-crud'
import type {
  FactsChannel,
  FactsRelease,
  FactsReleaseAsset,
  FactsReleaseCatalog,
} from '@cv/application-registry-entity'
import { Effect, Layer, Option } from 'effect'
import { FactsReleasesService } from '../services/facts-releases'
import type { RegisterFactsReleaseInput } from '../types'
import { FactsReleasesServiceLive } from './facts-releases'

const manifestSha = 'a'.repeat(64)
const catalogSha = 'b'.repeat(64)
const catalogRuSha = 'd'.repeat(64)
const assetSha = 'c'.repeat(64)
const manifestBytes = new TextEncoder().encode('{"manifest":true}')
const catalogBytes = new TextEncoder().encode('{"facts":[]}')
const catalogRuBytes = new TextEncoder().encode('{"facts":["ru"]}')
const assetBytes = new Uint8Array([10, 20, 30, 40])

const metadata = (sha256: string, bytes: Uint8Array): ArtifactMetadata => ({
  byteLength: bytes.byteLength,
  key: `sha256/${sha256}`,
  sha256,
})

const release: FactsRelease = {
  compilerCommit: 'compiler-commit',
  compilerRepository: 'https://example.test/cv',
  createdAt: '2026-07-17T12:34:56.789Z',
  factsSchemaVersion: '@cv/contracts/facts@1',
  id: 'facts-release-1',
  manifestByteLength: manifestBytes.byteLength,
  manifestObjectKey: `sha256/${manifestSha}`,
  manifestSha256: manifestSha,
  sourceCommit: 'facts-commit',
  sourceRepository: 'https://example.test/cv-content',
}

const catalog: FactsReleaseCatalog = {
  byteLength: catalogBytes.byteLength,
  locale: 'en',
  mediaType: 'application/json',
  objectKey: `sha256/${catalogSha}`,
  releaseId: release.id,
  sha256: catalogSha,
}

const catalogRu: FactsReleaseCatalog = {
  ...catalog,
  byteLength: catalogRuBytes.byteLength,
  locale: 'ru',
  objectKey: `sha256/${catalogRuSha}`,
  sha256: catalogRuSha,
}

const asset: FactsReleaseAsset = {
  assetId: 'portrait',
  byteLength: assetBytes.byteLength,
  fileName: 'portrait.webp',
  mediaType: 'image/webp',
  objectKey: `sha256/${assetSha}`,
  releaseId: release.id,
  sha256: assetSha,
}

const registration = (): RegisterFactsReleaseInput => ({
  assets: [asset],
  catalogs: [catalog, catalogRu],
  release,
})

type StoredObject = {
  readonly bytes: Uint8Array
  readonly metadata: ArtifactMetadata
}

type ArtifactFixtureOptions = {
  readonly headMetadata?: (
    sha256: string,
    value: ArtifactMetadata
  ) => ArtifactMetadata
  readonly readBytes?: (sha256: string, value: Uint8Array) => Uint8Array
}

const makeArtifactFixture = (options: ArtifactFixtureOptions = {}) => {
  const objects = new Map<string, StoredObject>([
    [
      manifestSha,
      { bytes: manifestBytes, metadata: metadata(manifestSha, manifestBytes) },
    ],
    [
      catalogSha,
      { bytes: catalogBytes, metadata: metadata(catalogSha, catalogBytes) },
    ],
    [
      catalogRuSha,
      {
        bytes: catalogRuBytes,
        metadata: metadata(catalogRuSha, catalogRuBytes),
      },
    ],
    [assetSha, { bytes: assetBytes, metadata: metadata(assetSha, assetBytes) }],
  ])
  const heads: string[] = []
  const store: ArtifactStoreShape = {
    head: (sha256) =>
      Effect.sync(() => {
        heads.push(sha256)
        const object = objects.get(sha256)
        if (!object) return Option.none()
        return Option.some(
          options.headMetadata?.(sha256, object.metadata) ?? object.metadata
        )
      }),
    put: () =>
      Effect.fail(
        new ArtifactStoreHashError({
          cause: new Error('Unexpected put in facts service test.'),
          message: 'Unexpected put in facts service test.',
        })
      ),
    read: (sha256) => {
      const object = objects.get(sha256)
      return object
        ? Effect.succeed(
            options.readBytes?.(sha256, object.bytes) ?? object.bytes.slice()
          )
        : Effect.fail(
            new ArtifactStoreNotFoundError({
              key: `sha256/${sha256}`,
              message: 'Test object not found.',
              sha256,
            })
          )
    },
  }
  return { heads, layer: Layer.succeed(ArtifactStore, store), objects }
}

type CrudState = {
  readonly assets: Map<string, readonly FactsReleaseAsset[]>
  readonly catalogs: Map<string, readonly FactsReleaseCatalog[]>
  readonly channels: Map<string, FactsChannel>
  readonly releases: Map<string, FactsRelease>
  registerCalls: number
}

const makeCrudFixture = () => {
  const state: CrudState = {
    assets: new Map(),
    catalogs: new Map(),
    channels: new Map(),
    releases: new Map(),
    registerCalls: 0,
  }
  const crud: FactsReleasesCrudShape = {
    activate: (channel, releaseId, expectedVersion, updatedAt) =>
      Effect.sync(() => {
        const current = state.channels.get(channel)
        if (current && current.version !== expectedVersion) return false
        if (!current && expectedVersion !== 0) return false
        state.channels.set(channel, {
          activeReleaseId: releaseId,
          name: channel,
          updatedAt,
          version: current ? current.version + 1 : 1,
        })
        return true
      }),
    assets: (releaseId) => Effect.succeed(state.assets.get(releaseId) ?? []),
    catalogs: (releaseId) =>
      Effect.succeed(state.catalogs.get(releaseId) ?? []),
    find: (releaseId) => Effect.succeed(state.releases.get(releaseId)),
    findActiveCatalog: (channel, locale) =>
      Effect.sync((): ActiveFactsCatalog | undefined => {
        const activeChannel = state.channels.get(channel)
        if (!activeChannel) return undefined
        const activeRelease = state.releases.get(activeChannel.activeReleaseId)
        const activeCatalog = state.catalogs
          .get(activeChannel.activeReleaseId)
          ?.find((candidate) => candidate.locale === locale)
        return activeRelease && activeCatalog
          ? {
              catalog: activeCatalog,
              channel: activeChannel,
              release: activeRelease,
            }
          : undefined
      }),
    register: (input: PersistedFactsRelease) =>
      Effect.sync(() => {
        state.registerCalls += 1
        if (!state.releases.has(input.release.id)) {
          state.releases.set(input.release.id, input.release)
          state.catalogs.set(input.release.id, [...input.catalogs])
          state.assets.set(input.release.id, [...input.assets])
        }
      }),
  }
  return { layer: Layer.succeed(FactsReleasesCrud, crud), state }
}

const makeHarness = (artifactOptions: ArtifactFixtureOptions = {}) => {
  const artifacts = makeArtifactFixture(artifactOptions)
  const crud = makeCrudFixture()
  const layer = FactsReleasesServiceLive.pipe(
    Layer.provide(crud.layer),
    Layer.provide(artifacts.layer)
  )
  const run = <A, E>(effect: Effect.Effect<A, E, FactsReleasesService>) =>
    Effect.runPromise(effect.pipe(Effect.provide(layer)))
  return { artifacts, crud, run }
}

const register = FactsReleasesService.use((service) =>
  service.register(registration())
)

describe('FactsReleasesService registration', () => {
  test('rejects a release without any configured locale catalogue', async () => {
    const harness = makeHarness()
    const error = await harness.run(
      FactsReleasesService.use((service) =>
        service.register({
          ...registration(),
          catalogs: [],
        })
      ).pipe(Effect.flip)
    )

    expect(error._tag).toBe('RegistryBadRequestError')
    expect(harness.crud.state.registerCalls).toBe(0)
  })

  test('verifies every object before registering immutable metadata', async () => {
    const harness = makeHarness()
    const stored = await harness.run(register)

    expect(harness.artifacts.heads).toEqual([
      manifestSha,
      catalogSha,
      catalogRuSha,
      assetSha,
    ])
    expect(harness.crud.state.registerCalls).toBe(1)
    expect(stored).toEqual(registration())

    const replay = await harness.run(register)
    expect(replay).toEqual(stored)
    expect(harness.crud.state.registerCalls).toBe(1)
  })

  test('does not register when any referenced object is missing', async () => {
    const harness = makeHarness()
    harness.artifacts.objects.delete(assetSha)

    const error = await harness.run(register.pipe(Effect.flip))

    expect(error._tag).toBe('FactsReleaseObjectNotFoundError')
    if (error._tag !== 'FactsReleaseObjectNotFoundError') {
      throw new Error('Expected a missing facts release object.')
    }
    expect(error.logicalId).toBe(asset.assetId)
    expect(harness.crud.state.registerCalls).toBe(0)
  })

  for (const field of ['byteLength', 'key', 'sha256'] as const) {
    test(`rejects inconsistent ${field} metadata before registration`, async () => {
      const harness = makeHarness({
        headMetadata: (sha256, value) =>
          sha256 !== catalogSha
            ? value
            : {
                ...value,
                [field]:
                  field === 'byteLength'
                    ? value.byteLength + 1
                    : field === 'key'
                      ? 'sha256/wrong-key'
                      : 'd'.repeat(64),
              },
      })

      const error = await harness.run(register.pipe(Effect.flip))

      expect(error._tag).toBe('FactsReleaseObjectMetadataError')
      if (error._tag !== 'FactsReleaseObjectMetadataError') {
        throw new Error('Expected inconsistent facts release metadata.')
      }
      expect(error.field).toBe(field)
      expect(error.logicalId).toBe(catalog.locale)
      expect(harness.crud.state.registerCalls).toBe(0)
    })
  }

  test('rejects an immutable release-id replay with different metadata', async () => {
    const harness = makeHarness()
    await harness.run(register)
    const changed = {
      ...registration(),
      release: { ...release, sourceCommit: 'another-commit' },
    }

    const error = await harness.run(
      FactsReleasesService.use((service) => service.register(changed)).pipe(
        Effect.flip
      )
    )

    expect(error._tag).toBe('RegistryConflictError')
    expect(harness.crud.state.registerCalls).toBe(1)
  })

  test('rejects foreign and duplicate descriptors before object access', async () => {
    const harness = makeHarness()
    const invalid = {
      ...registration(),
      catalogs: [catalog, { ...catalog }],
    }

    const error = await harness.run(
      FactsReleasesService.use((service) => service.register(invalid)).pipe(
        Effect.flip
      )
    )

    expect(error._tag).toBe('RegistryBadRequestError')
    expect(harness.artifacts.heads).toEqual([])
    expect(harness.crud.state.registerCalls).toBe(0)
  })
})

describe('FactsReleasesService active channels', () => {
  test('atomically activates and reads every locale in the release', async () => {
    const harness = makeHarness()
    await harness.run(register)

    const first = await harness.run(
      FactsReleasesService.use((service) =>
        service.activate('stable', release.id, 0)
      )
    )
    expect(first.activeReleaseId).toBe(release.id)
    expect(first.version).toBe(1)

    const active = await harness.run(
      FactsReleasesService.use((service) => service.readActive('stable', 'en'))
    )
    expect(active.release.id).toBe(release.id)
    expect([...active.catalogBytes]).toEqual([...catalogBytes])
    expect(active.catalogs.map(({ locale }) => locale)).toEqual(['en', 'ru'])
    expect(active.assetContents).toHaveLength(1)
    const firstAsset = active.assetContents[0]
    if (!firstAsset) throw new Error('Expected one active facts asset.')
    expect([...firstAsset.bytes]).toEqual([...assetBytes])

    const selectedAsset = await harness.run(
      FactsReleasesService.use((service) =>
        service.readActiveAsset('stable', 'en', asset.assetId)
      )
    )
    expect(selectedAsset.asset).toEqual(asset)
    expect([...selectedAsset.bytes]).toEqual([...assetBytes])

    const russian = await harness.run(
      FactsReleasesService.use((service) => service.readActive('stable', 'ru'))
    )
    expect([...russian.catalogBytes]).toEqual([...catalogRuBytes])
  })

  test('rejects stale activation without mutating the channel', async () => {
    const harness = makeHarness()
    await harness.run(register)
    await harness.run(
      FactsReleasesService.use((service) =>
        service.activate('stable', release.id, 0)
      )
    )

    const error = await harness.run(
      FactsReleasesService.use((service) =>
        service.activate('stable', release.id, 0)
      ).pipe(Effect.flip)
    )

    expect(error._tag).toBe('RegistryConflictError')
    expect(harness.crud.state.channels.get('stable')?.version).toBe(1)

    const advanced = await harness.run(
      FactsReleasesService.use((service) =>
        service.activate('stable', release.id, 1)
      )
    )
    expect(advanced.version).toBe(2)
  })

  test('rejects unsupported locales and reports missing assets', async () => {
    const harness = makeHarness()
    await harness.run(register)
    await harness.run(
      FactsReleasesService.use((service) =>
        service.activate('stable', release.id, 0)
      )
    )

    const localeError = await harness.run(
      FactsReleasesService.use((service) =>
        service.readActiveCatalog('stable', 'fr')
      ).pipe(Effect.flip)
    )
    const assetError = await harness.run(
      FactsReleasesService.use((service) =>
        service.readActiveAsset('stable', 'en', 'missing')
      ).pipe(Effect.flip)
    )

    expect(localeError._tag).toBe('RegistryNotFoundError')
    expect(assetError._tag).toBe('RegistryNotFoundError')
  })

  test('rechecks object byte lengths when reading active content', async () => {
    const harness = makeHarness({
      readBytes: (sha256, value) =>
        sha256 === catalogSha ? new Uint8Array(value.byteLength + 1) : value,
    })
    await harness.run(register)
    await harness.run(
      FactsReleasesService.use((service) =>
        service.activate('stable', release.id, 0)
      )
    )

    const error = await harness.run(
      FactsReleasesService.use((service) =>
        service.readActiveCatalog('stable', 'en')
      ).pipe(Effect.flip)
    )

    expect(error._tag).toBe('FactsReleaseObjectMetadataError')
    if (error._tag !== 'FactsReleaseObjectMetadataError') {
      throw new Error('Expected inconsistent facts release metadata.')
    }
    expect(error.field).toBe('byteLength')
  })
})
