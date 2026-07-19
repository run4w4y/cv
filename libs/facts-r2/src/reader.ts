import {
  type FactsCatalogueV1,
  FactsCatalogueV1Schema,
} from '@cv/contracts/facts'
import {
  type FactsCurrentPointerV1,
  FactsCurrentPointerV1Schema,
  type FactsReleaseManifestV1,
  FactsReleaseManifestV1Schema,
  factsCurrentObjectKey,
  factsReleaseCatalogueObjectKey,
  factsReleaseManifestObjectKey,
} from '@cv/facts-release'
import { Context, Crypto, Effect, Layer, Schema } from 'effect'

import { FactsReaderError } from './errors'
import { FactsObjectStore, type StoredFactsObject } from './object-store'

export type LoadedFactsCatalogue = {
  readonly catalogue: FactsCatalogueV1
  readonly current: FactsCurrentPointerV1
  readonly etag: string | undefined
  readonly manifest: FactsReleaseManifestV1
  readonly releaseId: string
}

export interface FactsReaderShape {
  readonly read: (
    locale: string
  ) => Effect.Effect<LoadedFactsCatalogue, FactsReaderError>
}

export class FactsReader extends Context.Service<
  FactsReader,
  FactsReaderShape
>()('@cv/facts-r2/FactsReader') {}

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
) =>
  Effect.try({
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
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(schema)),
    Effect.mapError((cause) =>
      cause instanceof FactsReaderError
        ? cause
        : readerError(
            operation,
            key,
            cause,
            `Facts object ${key} does not match its schema.`
          )
    )
  )

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

    const read = Effect.fn('FactsReader.read')(function* (locale: string) {
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
        FactsCurrentPointerV1Schema,
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
        FactsReleaseManifestV1Schema,
        manifestObject,
        manifestKey,
        'decode-manifest'
      )
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
      return {
        catalogue,
        current,
        etag: currentObject.etag,
        manifest,
        releaseId: current.releaseId,
      }
    })

    return FactsReader.of({ read })
  })
)
