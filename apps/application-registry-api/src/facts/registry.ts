import {
  compileFactsCurrentPointerObject,
  type FactsCurrentPointerV2,
  FactsCurrentPointerV2Schema,
  factsCurrentObjectKey,
  factsReleaseManifestMediaType,
  factsReleaseManifestObjectKey,
  type PublishedFactsObject,
  verifyFactsReleaseBundle,
} from '@cv/facts-release'
import { Context, Crypto, Effect, Layer, Schema } from 'effect'

import {
  FactsStorage,
  type FactsStorageMetadata,
  type FactsStorageObject,
} from './storage'

export class FactsRegistryError extends Schema.TaggedErrorClass<FactsRegistryError>()(
  'FactsRegistryError',
  {
    cause: Schema.Defect(),
    issue: Schema.Literals([
      'conflict',
      'invalid-bundle',
      'not-found',
      'storage',
    ]),
    message: Schema.String,
  }
) {}

export type FactsRegistrationResult = {
  readonly objectCount: number
  readonly releaseId: string
  readonly status: 'already-registered' | 'registered'
}

export type FactsActivationResult = {
  readonly releaseId: string
  readonly status: 'activated' | 'already-active'
}

export interface FactsRegistryShape {
  readonly activate: (input: {
    readonly expectedCurrentReleaseId: string | null
    readonly releaseId: string
  }) => Effect.Effect<FactsActivationResult, FactsRegistryError>
  readonly current: () => Effect.Effect<
    FactsCurrentPointerV2 | null,
    FactsRegistryError
  >
  readonly register: (
    expectedReleaseId: string,
    bundle: Uint8Array
  ) => Effect.Effect<FactsRegistrationResult, FactsRegistryError>
}

export class FactsRegistry extends Context.Service<
  FactsRegistry,
  FactsRegistryShape
>()('@cv/application-registry-api/FactsRegistry') {}

const registryError = (
  issue: FactsRegistryError['issue'],
  message: string,
  cause: unknown
) => new FactsRegistryError({ cause, issue, message })

const storageFailure = (message: string) =>
  Effect.mapError((cause: unknown) => registryError('storage', message, cause))

const storedObjectMatches = (
  existing: FactsStorageMetadata,
  object: PublishedFactsObject
) =>
  existing.size === object.byteLength &&
  existing.mediaType === object.mediaType &&
  existing.sha256 === object.sha256

const putImmutable = Effect.fn('FactsRegistry.putImmutable')(function* (
  storage: FactsStorage['Service'],
  object: PublishedFactsObject
) {
  const written = yield* storage
    .put({
      bytes: object.bytes,
      cacheControl: object.cacheControl,
      condition: { _tag: 'Create' },
      key: object.key,
      mediaType: object.mediaType,
      sha256: object.sha256,
    })
    .pipe(
      storageFailure(
        `Facts object storage failed while attempting to write ${object.key}.`
      )
    )
  if (written) return true

  const existing = yield* storage
    .head(object.key)
    .pipe(
      storageFailure(
        `Facts object storage failed while attempting to inspect ${object.key}.`
      )
    )
  if (existing === null || !storedObjectMatches(existing, object)) {
    return yield* registryError(
      'conflict',
      `Immutable facts object ${object.key} already exists with different metadata.`,
      object.key
    )
  }
  return false
})

const decodeCurrent = (object: FactsStorageObject) =>
  Effect.try({
    try: () =>
      JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(object.bytes)
      ) as unknown,
    catch: (cause) =>
      registryError(
        'storage',
        'The active facts release pointer is not valid UTF-8 JSON.',
        cause
      ),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(FactsCurrentPointerV2Schema)),
    Effect.mapError((cause) =>
      cause instanceof FactsRegistryError
        ? cause
        : registryError(
            'storage',
            'The active facts release pointer does not match its contract.',
            cause
          )
    )
  )

export const FactsRegistryLive = Layer.effect(
  FactsRegistry,
  Effect.gen(function* () {
    const storage = yield* FactsStorage
    const crypto = yield* Crypto.Crypto

    const currentObject = Effect.fn('FactsRegistry.currentObject')(
      function* () {
        return yield* storage
          .get(factsCurrentObjectKey)
          .pipe(
            storageFailure(
              'Facts object storage failed while attempting to read current.json.'
            )
          )
      }
    )

    const current = Effect.fn('FactsRegistry.current')(function* () {
      const object = yield* currentObject()
      return object === null ? null : yield* decodeCurrent(object)
    })

    const register = Effect.fn('FactsRegistry.register')(function* (
      expectedReleaseId: string,
      bytes: Uint8Array
    ) {
      const bundle = yield* verifyFactsReleaseBundle(bytes).pipe(
        Effect.provideService(Crypto.Crypto, crypto),
        Effect.mapError((cause) =>
          registryError('invalid-bundle', cause.message, cause)
        )
      )
      if (bundle.releaseId !== expectedReleaseId) {
        return yield* registryError(
          'invalid-bundle',
          'Facts release path does not match the bundle release ID.',
          expectedReleaseId
        )
      }
      const writes = yield* Effect.forEach(bundle.objects, (object) =>
        putImmutable(storage, object)
      )
      return {
        objectCount: bundle.objects.length,
        releaseId: bundle.releaseId,
        status: writes.some(Boolean)
          ? ('registered' as const)
          : ('already-registered' as const),
      }
    })

    const activate = Effect.fn('FactsRegistry.activate')(function* (input: {
      readonly expectedCurrentReleaseId: string | null
      readonly releaseId: string
    }) {
      const beforeObject = yield* currentObject()
      const before =
        beforeObject === null ? null : yield* decodeCurrent(beforeObject)
      if (before?.releaseId === input.releaseId) {
        return {
          releaseId: input.releaseId,
          status: 'already-active' as const,
        }
      }
      if ((before?.releaseId ?? null) !== input.expectedCurrentReleaseId) {
        return yield* registryError(
          'conflict',
          'The active facts release changed before activation.',
          before?.releaseId
        )
      }

      const manifestKey = factsReleaseManifestObjectKey(input.releaseId)
      const manifest = yield* storage
        .head(manifestKey)
        .pipe(
          storageFailure(
            'Facts object storage failed while inspecting the release manifest.'
          )
        )
      const manifestSha256 = manifest?.sha256
      if (
        manifest === null ||
        manifest.mediaType !== factsReleaseManifestMediaType ||
        manifestSha256 !== input.releaseId.slice(3)
      ) {
        return yield* registryError(
          'not-found',
          `Facts release ${input.releaseId} is not registered.`,
          manifestKey
        )
      }

      const pointer = yield* compileFactsCurrentPointerObject({
        byteLength: manifest.size,
        sha256: manifestSha256,
      }).pipe(
        Effect.provideService(Crypto.Crypto, crypto),
        Effect.mapError((cause) =>
          registryError(
            'storage',
            'The active facts release pointer could not be compiled.',
            cause
          )
        )
      )
      const written = yield* storage
        .put({
          bytes: pointer.object.bytes,
          cacheControl: pointer.object.cacheControl,
          condition:
            beforeObject === null
              ? { _tag: 'Create' as const }
              : { _tag: 'Match' as const, etag: beforeObject.etag },
          key: factsCurrentObjectKey,
          mediaType: pointer.object.mediaType,
          sha256: pointer.object.sha256,
        })
        .pipe(
          storageFailure(
            'Facts object storage failed while activating the release.'
          )
        )
      if (!written) {
        return yield* registryError(
          'conflict',
          'The active facts release changed during activation.',
          input.expectedCurrentReleaseId
        )
      }
      return { releaseId: input.releaseId, status: 'activated' as const }
    })

    return FactsRegistry.of({ activate, current, register })
  })
)

export const factsRegistryLayer = (storage: Layer.Layer<FactsStorage>) =>
  FactsRegistryLive.pipe(Layer.provide(storage))
