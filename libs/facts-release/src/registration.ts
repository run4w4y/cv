import { Effect, Schema } from 'effect'

import { FactsReleaseValidationError } from './errors'
import type { CompiledFactsRelease, FactsReleaseRegistration } from './model'

const UtcIsoTimestampSchema = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u)
  )
)

export const makeFactsReleaseRegistration = Effect.fn(
  'FactsRelease.makeRegistration'
)(
  (
    bundle: CompiledFactsRelease,
    createdAt: string
  ): Effect.Effect<FactsReleaseRegistration, FactsReleaseValidationError> =>
    Schema.decodeUnknownEffect(UtcIsoTimestampSchema)(createdAt).pipe(
      Effect.mapError(
        (cause) =>
          new FactsReleaseValidationError({
            cause,
            context: 'timestamp',
            message:
              'Facts release publication time must be a millisecond-precision UTC ISO timestamp.',
          })
      ),
      Effect.map((timestamp) => ({
        assets: bundle.manifest.assets.map((asset) => ({
          assetId: asset.id,
          byteLength: asset.object.byteLength,
          fileName: asset.fileName,
          mediaType: asset.object.mediaType,
          objectKey: asset.object.key,
          releaseId: bundle.releaseId,
          sha256: asset.object.sha256,
        })),
        catalogs: bundle.manifest.catalogues.map((catalogue) => ({
          byteLength: catalogue.object.byteLength,
          locale: catalogue.locale,
          mediaType: catalogue.object.mediaType,
          objectKey: catalogue.object.key,
          releaseId: bundle.releaseId,
          sha256: catalogue.object.sha256,
        })),
        release: {
          compilerCommit: bundle.manifest.provenance.compiler.commit,
          compilerRepository: bundle.manifest.provenance.compiler.repository,
          createdAt: timestamp,
          factsSchemaVersion: bundle.manifest.factsContract,
          id: bundle.releaseId,
          manifestByteLength: bundle.manifestObject.byteLength,
          manifestObjectKey: bundle.manifestObject.key,
          manifestSha256: bundle.manifestObject.sha256,
          sourceCommit: bundle.manifest.provenance.source.commit,
          sourceRepository: bundle.manifest.provenance.source.repository,
        },
      }))
    )
)
