import {
  type CvGenerationGuidanceV1,
  CvGenerationGuidanceV1Schema,
} from '@cv/contracts/document'
import {
  type FactsCatalogueV1,
  FactsCatalogueV1Schema,
} from '@cv/contracts/facts'
import { Crypto, Effect, Schema } from 'effect'

import {
  cvGenerationGuidanceMediaType,
  factsCatalogueMediaType,
  factsReleaseManifestMediaType,
} from './compiler'
import { FactsReleaseBundleError } from './errors'
import { encodeCanonicalJson } from './internal/canonical-json'
import {
  factsAssetObjectKey,
  factsReleaseCatalogueObjectKey,
  factsReleaseGenerationGuidanceObjectKey,
  factsReleaseManifestObjectKey,
} from './layout'
import type {
  CompiledFactsRelease,
  FactsReleaseManifestV2,
  PublishedFactsObject,
} from './model'
import { compileFactsPublicationObjects } from './publication'
import { FactsReleaseManifestV2Schema } from './schema'

export const factsReleaseBundleV1ContractId = 'cv.facts-bundle.v1' as const
export const factsReleaseBundleMediaType =
  'application/vnd.cv.facts-bundle+json' as const

const ReleaseIdSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^fr_[a-f0-9]{64}$/u))
)
const Sha256Schema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[a-f0-9]{64}$/u))
)
const NonNegativeIntegerSchema = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
)
const NonEmptyTextSchema = Schema.Trim.pipe(Schema.check(Schema.isNonEmpty()))

export const FactsReleaseBundleObjectV1Schema = Schema.Struct({
  byteLength: NonNegativeIntegerSchema,
  bytes: Schema.Uint8ArrayFromBase64,
  cacheControl: NonEmptyTextSchema,
  key: NonEmptyTextSchema,
  mediaType: NonEmptyTextSchema,
  sha256: Sha256Schema,
}).annotate({
  identifier: 'FactsReleaseBundleObjectV1',
  parseOptions: { errors: 'all', onExcessProperty: 'error' },
})

export const FactsReleaseBundleV1Schema = Schema.Struct({
  $schema: Schema.Literal(factsReleaseBundleV1ContractId),
  objects: Schema.Array(FactsReleaseBundleObjectV1Schema).pipe(
    Schema.check(Schema.isMinLength(1))
  ),
  releaseId: ReleaseIdSchema,
}).annotate({
  identifier: 'FactsReleaseBundleV1',
  parseOptions: { errors: 'all', onExcessProperty: 'error' },
})

export interface FactsReleaseBundleV1
  extends Schema.Schema.Type<typeof FactsReleaseBundleV1Schema> {}

export type VerifiedFactsReleaseBundle = FactsReleaseBundleV1 & {
  readonly catalogues: ReadonlyArray<FactsCatalogueV1>
  readonly generationGuidance: CvGenerationGuidanceV1
  readonly manifest: FactsReleaseManifestV2
}

const bundleError = (
  issue: FactsReleaseBundleError['issue'],
  message: string,
  cause: unknown
) => new FactsReleaseBundleError({ cause, issue, message })

const decodeJson = Effect.fn('FactsReleaseBundle.decodeJson')(function* (
  bytes: Uint8Array
) {
  const value = yield* Effect.try({
    try: () =>
      JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      ) as unknown,
    catch: (cause) =>
      bundleError(
        'decode',
        'Facts release bundle is not valid UTF-8 JSON.',
        cause
      ),
  })
  return yield* Schema.decodeUnknownEffect(FactsReleaseBundleV1Schema)(
    value
  ).pipe(
    Effect.mapError((cause) =>
      bundleError(
        'decode',
        'Facts release bundle does not match its contract.',
        cause
      )
    )
  )
})

const sha256Hex = Effect.fn('FactsReleaseBundle.sha256')(function* (
  bytes: Uint8Array
) {
  const crypto = yield* Crypto.Crypto
  const digest = yield* crypto.digest('SHA-256', bytes)
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join(
    ''
  )
})

const verifyObject = Effect.fn('FactsReleaseBundle.verifyObject')(function* (
  object: PublishedFactsObject
) {
  if (
    object.bytes.byteLength !== object.byteLength ||
    (yield* sha256Hex(object.bytes)) !== object.sha256
  ) {
    return yield* bundleError(
      'integrity',
      `Facts release object ${object.key} does not match its declared bytes.`,
      object.key
    )
  }
})

const decodeObject = <S extends Schema.Top>(
  schema: S,
  object: PublishedFactsObject,
  label: string
) =>
  Effect.try({
    try: () =>
      JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(object.bytes)
      ) as unknown,
    catch: (cause) =>
      bundleError('integrity', `${label} is not valid UTF-8 JSON.`, cause),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(schema)),
    Effect.mapError((cause) =>
      cause instanceof FactsReleaseBundleError
        ? cause
        : bundleError(
            'integrity',
            `${label} does not match its contract.`,
            cause
          )
    )
  )

const matchesDescriptor = (
  object: PublishedFactsObject,
  descriptor: {
    readonly byteLength: number
    readonly mediaType: string
    readonly sha256: string
  }
) =>
  object.byteLength === descriptor.byteLength &&
  object.mediaType === descriptor.mediaType &&
  object.sha256 === descriptor.sha256

export const compileFactsReleaseBundle = (
  release: CompiledFactsRelease
): FactsReleaseBundleV1 => ({
  $schema: factsReleaseBundleV1ContractId,
  objects: compileFactsPublicationObjects(release),
  releaseId: release.releaseId,
})

export const encodeFactsReleaseBundle = Effect.fn('FactsReleaseBundle.encode')(
  function* (bundle: FactsReleaseBundleV1) {
    const encoded = yield* Schema.encodeEffect(FactsReleaseBundleV1Schema)(
      bundle
    )
    return encodeCanonicalJson(encoded)
  }
)

export const verifyFactsReleaseBundle = Effect.fn('FactsReleaseBundle.verify')(
  function* (bytes: Uint8Array) {
    const bundle = yield* decodeJson(bytes)
    const indexed = new Map<string, PublishedFactsObject>()
    for (const object of bundle.objects) {
      if (indexed.has(object.key)) {
        return yield* bundleError(
          'layout',
          `Facts release bundle contains duplicate object ${object.key}.`,
          object.key
        )
      }
      yield* verifyObject(object)
      indexed.set(object.key, object)
    }

    const manifestKey = factsReleaseManifestObjectKey(bundle.releaseId)
    const manifestObject = indexed.get(manifestKey)
    if (
      manifestObject === undefined ||
      manifestObject.mediaType !== factsReleaseManifestMediaType ||
      bundle.releaseId !== `fr_${manifestObject.sha256}`
    ) {
      return yield* bundleError(
        'layout',
        'Facts release bundle does not contain its addressed manifest.',
        manifestKey
      )
    }
    const manifest = yield* decodeObject(
      FactsReleaseManifestV2Schema,
      manifestObject,
      'Facts release manifest'
    )

    const expectedKeys = new Set<string>([manifestKey])
    const catalogues = yield* Effect.forEach(
      manifest.catalogues,
      (descriptor) => {
        const key = factsReleaseCatalogueObjectKey(
          bundle.releaseId,
          descriptor.locale
        )
        expectedKeys.add(key)
        const object = indexed.get(key)
        if (
          object === undefined ||
          object.mediaType !== factsCatalogueMediaType ||
          !matchesDescriptor(object, descriptor.object)
        ) {
          return Effect.fail(
            bundleError(
              'layout',
              `Facts catalogue ${descriptor.locale} is missing or mismatched.`,
              key
            )
          )
        }
        return decodeObject(
          FactsCatalogueV1Schema,
          object,
          `Facts catalogue ${descriptor.locale}`
        ).pipe(
          Effect.flatMap((catalogue) =>
            catalogue.locale === descriptor.locale
              ? Effect.succeed(catalogue)
              : Effect.fail(
                  bundleError(
                    'integrity',
                    `Facts catalogue ${descriptor.locale} declares another locale.`,
                    catalogue.locale
                  )
                )
          )
        )
      }
    )

    const guidanceKey = factsReleaseGenerationGuidanceObjectKey(
      bundle.releaseId
    )
    expectedKeys.add(guidanceKey)
    const guidanceObject = indexed.get(guidanceKey)
    if (
      guidanceObject === undefined ||
      guidanceObject.mediaType !== cvGenerationGuidanceMediaType ||
      !matchesDescriptor(guidanceObject, manifest.generationGuidance.object)
    ) {
      return yield* bundleError(
        'layout',
        'Facts generation guidance is missing or mismatched.',
        guidanceKey
      )
    }
    const generationGuidance = yield* decodeObject(
      CvGenerationGuidanceV1Schema,
      guidanceObject,
      'Facts generation guidance'
    )

    for (const asset of manifest.assets) {
      const key = factsAssetObjectKey(asset.object.sha256)
      expectedKeys.add(key)
      const object = indexed.get(key)
      if (object === undefined || !matchesDescriptor(object, asset.object)) {
        return yield* bundleError(
          'layout',
          `Facts asset ${asset.id} is missing or mismatched.`,
          key
        )
      }
    }

    const unexpected = [...indexed.keys()].find((key) => !expectedKeys.has(key))
    if (unexpected !== undefined || indexed.size !== expectedKeys.size) {
      return yield* bundleError(
        'layout',
        `Facts release bundle contains an unexpected object ${unexpected ?? ''}.`,
        unexpected
      )
    }

    return {
      ...bundle,
      catalogues,
      generationGuidance,
      manifest,
    } satisfies VerifiedFactsReleaseBundle
  }
)
