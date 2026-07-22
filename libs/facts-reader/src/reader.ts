import {
  type CvGenerationGuidanceV1,
  CvGenerationGuidanceV1Schema,
} from '@cv/contracts/document'
import {
  type FactsCatalogueV1,
  FactsCatalogueV1Schema,
} from '@cv/contracts/facts'
import {
  type FactsCurrentPointerV2,
  FactsCurrentPointerV2Schema,
  type FactsReleaseManifestV2,
  FactsReleaseManifestV2Schema,
  factsCurrentObjectKey,
  factsReleaseCatalogueObjectKey,
  factsReleaseGenerationGuidanceObjectKey,
  factsReleaseManifestObjectKey,
} from '@cv/facts-release'
import { Context, Crypto, Effect, Layer, Schema } from 'effect'

import { FactsReaderError } from './errors'
import { FactsObjectStore, type StoredFactsObject } from './object-store'

export type LoadedActiveFactsRelease = {
  readonly current: FactsCurrentPointerV2
  readonly etag: string | undefined
  readonly locales: ReadonlyArray<string>
  readonly manifest: FactsReleaseManifestV2
  readonly releaseId: string
}

export type LoadedFactsCatalogue = LoadedActiveFactsRelease & {
  readonly catalogue: FactsCatalogueV1
  readonly generationGuidance: CvGenerationGuidanceV1
}

export type LoadedGenerationGuidance = LoadedActiveFactsRelease & {
  readonly generationGuidance: CvGenerationGuidanceV1
}

export interface FactsReaderShape {
  readonly read: (
    locale: string
  ) => Effect.Effect<LoadedFactsCatalogue, FactsReaderError>
  readonly readActiveRelease: () => Effect.Effect<
    LoadedActiveFactsRelease,
    FactsReaderError
  >
  readonly readForActiveRelease: (
    activeRelease: LoadedActiveFactsRelease,
    locale: string
  ) => Effect.Effect<LoadedFactsCatalogue, FactsReaderError>
  readonly readGenerationGuidance: () => Effect.Effect<
    LoadedGenerationGuidance,
    FactsReaderError
  >
}

export class FactsReader extends Context.Service<
  FactsReader,
  FactsReaderShape
>()('@cv/facts-reader/FactsReader') {}

const readerError = (
  operation: FactsReaderError['operation'],
  key: string,
  cause: unknown,
  message: string
) => new FactsReaderError({ cause, key, message, operation })

const decodeJson = <S extends Schema.Top>(
  schema: S,
  object: StoredFactsObject,
  key: string,
  operation: FactsReaderError['operation']
) => {
  const parse = Effect.try({
    try: () => {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(
        object.bytes
      )
      return JSON.parse(text) as unknown
    },
    catch: (cause) =>
      readerError(
        operation,
        key,
        cause,
        `Facts object ${key} is not valid UTF-8 JSON.`
      ),
  })

  return parse.pipe(
    Effect.flatMap((value) =>
      Schema.decodeUnknownEffect(schema)(value).pipe(
        Effect.mapError((cause) =>
          readerError(
            operation,
            key,
            cause,
            `Facts object ${key} does not match its schema.`
          )
        )
      )
    )
  )
}

const digest = Effect.fn('FactsReader.digest')(function* (
  crypto: Crypto.Crypto,
  bytes: Uint8Array
) {
  const value = yield* crypto.digest('SHA-256', bytes)
  return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  )
})

const verifyObject = Effect.fn('FactsReader.verifyObject')(function* (
  crypto: Crypto.Crypto,
  object: StoredFactsObject,
  descriptor: {
    readonly byteLength: number
    readonly mediaType: string
    readonly sha256: string
  },
  key: string,
  operation: FactsReaderError['operation']
) {
  const sha256 = yield* digest(crypto, object.bytes).pipe(
    Effect.mapError((cause) =>
      readerError(
        operation,
        key,
        cause,
        `Could not verify facts object ${key}.`
      )
    )
  )
  if (
    object.bytes.byteLength !== descriptor.byteLength ||
    sha256 !== descriptor.sha256 ||
    (object.mediaType !== undefined &&
      object.mediaType !== descriptor.mediaType)
  ) {
    return yield* Effect.fail(
      readerError(
        operation,
        key,
        new Error('Digest, length, or media type mismatch.'),
        `Facts object ${key} does not match its release manifest.`
      )
    )
  }
})

export const factsReaderLayer = Layer.effect(
  FactsReader,
  Effect.gen(function* () {
    const store = yield* FactsObjectStore
    const crypto = yield* Crypto.Crypto

    const readActiveRelease = Effect.fn('FactsReader.readActiveRelease')(
      function* () {
        const currentObject = yield* store
          .get(factsCurrentObjectKey)
          .pipe(
            Effect.mapError((cause) =>
              readerError(
                'read-current',
                factsCurrentObjectKey,
                cause,
                'Could not read the active private facts release.'
              )
            )
          )
        const current = yield* decodeJson(
          FactsCurrentPointerV2Schema,
          currentObject,
          factsCurrentObjectKey,
          'decode-current'
        )
        const manifestKey = factsReleaseManifestObjectKey(current.releaseId)
        const manifestObject = yield* store
          .get(manifestKey)
          .pipe(
            Effect.mapError((cause) =>
              readerError(
                'read-manifest',
                manifestKey,
                cause,
                `Could not read facts release ${current.releaseId}.`
              )
            )
          )
        yield* verifyObject(
          crypto,
          manifestObject,
          current.manifest,
          manifestKey,
          'verify-manifest'
        )
        const manifest = yield* decodeJson(
          FactsReleaseManifestV2Schema,
          manifestObject,
          manifestKey,
          'decode-manifest'
        )
        return {
          current,
          etag: currentObject.etag,
          locales: manifest.catalogues.map(({ locale }) => locale),
          manifest,
          releaseId: current.releaseId,
        }
      }
    )

    const readGenerationGuidanceForActiveRelease = Effect.fn(
      'FactsReader.readGenerationGuidanceForActiveRelease'
    )(function* (activeRelease: LoadedActiveFactsRelease) {
      const generationGuidanceKey = factsReleaseGenerationGuidanceObjectKey(
        activeRelease.releaseId
      )
      const generationGuidanceObject = yield* store
        .get(generationGuidanceKey)
        .pipe(
          Effect.mapError((cause) =>
            readerError(
              'read-generation-guidance',
              generationGuidanceKey,
              cause,
              `Could not read CV generation guidance from facts release ${activeRelease.releaseId}.`
            )
          )
        )
      yield* verifyObject(
        crypto,
        generationGuidanceObject,
        activeRelease.manifest.generationGuidance.object,
        generationGuidanceKey,
        'verify-generation-guidance'
      )
      const generationGuidance = yield* decodeJson(
        CvGenerationGuidanceV1Schema,
        generationGuidanceObject,
        generationGuidanceKey,
        'decode-generation-guidance'
      )
      return { ...activeRelease, generationGuidance }
    })

    const readGenerationGuidance = Effect.fn(
      'FactsReader.readGenerationGuidance'
    )(function* () {
      const activeRelease = yield* readActiveRelease()
      return yield* readGenerationGuidanceForActiveRelease(activeRelease)
    })

    const readForActiveRelease = Effect.fn('FactsReader.readForActiveRelease')(
      function* (activeRelease: LoadedActiveFactsRelease, locale: string) {
        const { current, manifest } = activeRelease
        const manifestKey = factsReleaseManifestObjectKey(current.releaseId)
        const catalogueDescriptor = manifest.catalogues.find(
          (catalogue) => catalogue.locale === locale
        )
        if (catalogueDescriptor === undefined) {
          return yield* Effect.fail(
            readerError(
              'read-catalogue',
              manifestKey,
              new Error(`Locale ${locale} is absent.`),
              `Facts release ${current.releaseId} does not contain locale ${locale}.`
            )
          )
        }
        const catalogueKey = factsReleaseCatalogueObjectKey(
          current.releaseId,
          locale
        )
        const catalogueObject = yield* store
          .get(catalogueKey)
          .pipe(
            Effect.mapError((cause) =>
              readerError(
                'read-catalogue',
                catalogueKey,
                cause,
                `Could not read locale ${locale} from facts release ${current.releaseId}.`
              )
            )
          )
        yield* verifyObject(
          crypto,
          catalogueObject,
          catalogueDescriptor.object,
          catalogueKey,
          'verify-catalogue'
        )
        const catalogue = yield* decodeJson(
          FactsCatalogueV1Schema,
          catalogueObject,
          catalogueKey,
          'decode-catalogue'
        )
        if (catalogue.locale !== locale) {
          return yield* Effect.fail(
            readerError(
              'decode-catalogue',
              catalogueKey,
              new Error(`Decoded locale ${catalogue.locale}.`),
              `Facts catalogue locale ${catalogue.locale} does not match requested locale ${locale}.`
            )
          )
        }
        const loadedGuidance =
          yield* readGenerationGuidanceForActiveRelease(activeRelease)
        return {
          ...loadedGuidance,
          catalogue,
        }
      }
    )

    const read = Effect.fn('FactsReader.read')(function* (locale: string) {
      const activeRelease = yield* readActiveRelease()
      return yield* readForActiveRelease(activeRelease, locale)
    })

    return FactsReader.of({
      read,
      readActiveRelease,
      readForActiveRelease,
      readGenerationGuidance,
    })
  })
)
