import { Effect } from 'effect'

import { FactsReleaseIntegrityError } from './errors'
import { encodeCanonicalJson } from './internal/canonical-json'
import { contentAddress, sha256Hex } from './internal/hash'
import type { CompiledFactsRelease, FactsReleaseObject } from './model'

const verifyObject = (object: FactsReleaseObject) =>
  Effect.gen(function* () {
    if (object.bytes.byteLength !== object.byteLength) {
      return yield* new FactsReleaseIntegrityError({
        key: object.key,
        message: `Facts release object "${object.key}" has another byte length than declared.`,
      })
    }

    const digest = yield* sha256Hex(object.bytes)
    if (digest !== object.sha256 || object.key !== contentAddress(digest)) {
      return yield* new FactsReleaseIntegrityError({
        key: object.key,
        message: `Facts release object "${object.key}" failed content-address verification.`,
      })
    }
  })

const equalBytes = (left: Uint8Array, right: Uint8Array) => {
  if (left.byteLength !== right.byteLength) {
    return false
  }
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }
  return true
}

const descriptorMatches = (
  descriptor: {
    readonly byteLength: number
    readonly key: string
    readonly sha256: string
  },
  object: FactsReleaseObject
) =>
  descriptor.key === object.key &&
  descriptor.sha256 === object.sha256 &&
  descriptor.byteLength === object.byteLength

const integrityFailure = (key: string, message: string) =>
  new FactsReleaseIntegrityError({ key, message })

export const verifyFactsReleaseBundle = Effect.fn('FactsRelease.verifyBundle')(
  (bundle: CompiledFactsRelease) =>
    Effect.gen(function* () {
      yield* Effect.forEach(bundle.objects, verifyObject, { discard: true })
      yield* verifyObject(bundle.manifestObject)

      if (bundle.releaseId !== `fr_${bundle.manifestObject.sha256}`) {
        return yield* new FactsReleaseIntegrityError({
          key: bundle.manifestObject.key,
          message: 'Facts release ID does not match the manifest digest.',
        })
      }

      const canonicalManifest = yield* encodeCanonicalJson(
        bundle.manifest,
        'manifest'
      )
      if (!equalBytes(canonicalManifest, bundle.manifestObject.bytes)) {
        return yield* new FactsReleaseIntegrityError({
          key: bundle.manifestObject.key,
          message:
            'Facts release manifest metadata does not match the addressed manifest bytes.',
        })
      }

      const manifestInObjects = bundle.objects.some(
        (object) => object.key === bundle.manifestObject.key
      )
      if (!manifestInObjects) {
        return yield* new FactsReleaseIntegrityError({
          key: bundle.manifestObject.key,
          message: 'Facts release object set does not include its manifest.',
        })
      }

      const catalogueReference = bundle.manifest.catalogues[0]
      if (
        !catalogueReference ||
        bundle.manifest.catalogues.length !== 1 ||
        catalogueReference.locale !== bundle.catalogue.locale ||
        bundle.manifest.factsContract !== bundle.catalogue.$schema
      ) {
        return yield* integrityFailure(
          bundle.manifestObject.key,
          'Facts release manifest does not describe its compiled catalogue.'
        )
      }

      const catalogueBytes = yield* encodeCanonicalJson(
        bundle.catalogue,
        'catalogue'
      )
      const catalogueDigest = yield* sha256Hex(catalogueBytes)
      const catalogueObject = bundle.objects.find(
        (object) => object.key === catalogueReference.object.key
      )
      if (
        catalogueReference.object.sha256 !== catalogueDigest ||
        catalogueReference.object.byteLength !== catalogueBytes.byteLength ||
        !catalogueObject ||
        !descriptorMatches(catalogueReference.object, catalogueObject) ||
        !equalBytes(catalogueBytes, catalogueObject.bytes)
      ) {
        return yield* integrityFailure(
          catalogueReference.object.key,
          'Facts release catalogue does not match its manifest descriptor.'
        )
      }

      const manifestAssets = new Map(
        bundle.manifest.assets.map((asset) => [asset.id, asset])
      )
      if (
        manifestAssets.size !== bundle.manifest.assets.length ||
        manifestAssets.size !== bundle.catalogue.assets.length
      ) {
        return yield* integrityFailure(
          bundle.manifestObject.key,
          'Facts release manifest asset identifiers are not an exact set.'
        )
      }

      for (const asset of bundle.catalogue.assets) {
        const reference = manifestAssets.get(asset.id)
        const object = reference
          ? bundle.objects.find(
              (candidate) => candidate.key === reference.object.key
            )
          : undefined
        if (
          !reference ||
          reference.object.sha256 !== asset.sha256 ||
          reference.object.mediaType !== asset.mediaType ||
          !object ||
          !descriptorMatches(reference.object, object)
        ) {
          return yield* integrityFailure(
            reference?.object.key ?? bundle.manifestObject.key,
            `Facts asset "${asset.id}" does not match its manifest descriptor.`
          )
        }
      }

      const expectedKeys = new Set([
        bundle.manifestObject.key,
        catalogueReference.object.key,
        ...bundle.manifest.assets.map((asset) => asset.object.key),
      ])
      const unexpectedObject = bundle.objects.find(
        (object) => !expectedKeys.has(object.key)
      )
      if (unexpectedObject) {
        return yield* integrityFailure(
          unexpectedObject.key,
          `Facts release contains unreferenced object "${unexpectedObject.key}".`
        )
      }
    })
)
