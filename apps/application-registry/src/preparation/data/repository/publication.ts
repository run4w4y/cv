import type { CvLink, GeneratedArtifact } from '@cv/application-registry-entity'
import { Effect } from 'effect'

import type { RegistryClient } from '@/lib/registry-client'
import type { PublicationIdentity } from '../keys'
import type {
  CvPageState,
  ReadCurrentPdfInput,
  ReadPdfJobInput,
  SetPublicationAvailabilityInput,
  StartPdfGenerationInput,
  StageCvInput,
} from '../types'
import { dataError } from './shared'

export const makePreparationPublicationRepository = (
  registry: RegistryClient['Service']
) => {
  const currentPdfArtifact = Effect.fn(
    'PreparationRepository.currentPdfArtifact'
  )((identity: PublicationIdentity) => {
    const read = (rendererVersion?: string) =>
      registry.publications.getCurrentPdfArtifact({
        params: {
          entryId: identity.entryId,
          id: identity.applicationId,
        },
        query: rendererVersion === undefined ? {} : { rendererVersion },
      })
    return identity.rendererVersion === undefined
      ? read()
      : read(identity.rendererVersion).pipe(
          Effect.catchTag('NotFoundError', () => read())
        )
  })

  const loadCvPageState = Effect.fn(
    'PreparationRepository.loadCvPageState'
  )(
    function* (identity: PublicationIdentity) {
      const link = yield* registry.publications
        .getCvLink({
            params: {
              entryId: identity.entryId,
              id: identity.applicationId,
            },
          })
        .pipe(
          Effect.map((value): CvLink | null => value),
          Effect.catchTag('NotFoundError', () => Effect.succeed<CvLink | null>(null))
        )
      if (link === null) return null
      const artifact = yield* currentPdfArtifact(identity).pipe(
        Effect.map((value): GeneratedArtifact | null => value),
        Effect.catchTag('NotFoundError', () =>
          Effect.succeed<GeneratedArtifact | null>(null)
        )
      )
      return {
        artifact:
          artifact !== null &&
          artifact.cvLinkId === link.id &&
          artifact.contentRevisionId === link.currentRevisionId &&
          artifact.publicationVersion === link.publicationVersion &&
          artifact.qrTarget === link.publicUrl
            ? artifact
            : null,
        link,
      } satisfies CvPageState
    },
    (effect) => effect.pipe(dataError('load-cv-page'))
  )

  const stageCv = Effect.fn('PreparationRepository.stageCv')(
    (input: StageCvInput) =>
      registry.publications
        .stageCv({
          params: {
            entryId: input.entry.id,
            id: input.applicationId,
          },
          payload: {
            expectedContentVersion: input.entry.version,
            publicBaseUrl: input.publicBaseUrl,
            revisionId: input.revisionId,
          },
        })
        .pipe(dataError('stage-cv'))
  )

  const setPublicationAvailability = Effect.fn(
    'PreparationRepository.setPublicationAvailability'
  )((input: SetPublicationAvailabilityInput) =>
    registry.publications
      .setCvLinkAvailability({
        params: {
          entryId: input.entryId,
          id: input.applicationId,
        },
        payload: input.input,
      })
      .pipe(dataError('set-publication-availability'))
  )

  const startPdfGeneration = Effect.fn(
    'PreparationRepository.startPdfGeneration'
  )((input: StartPdfGenerationInput) =>
    registry.publications
      .startPdfJob({
        params: {
          entryId: input.entryId,
          id: input.applicationId,
        },
        payload: input.input,
      })
      .pipe(dataError('start-pdf-generation'))
  )

  const readPdfJob = Effect.fn('PreparationRepository.readPdfJob')(
    (input: ReadPdfJobInput) =>
      registry.publications
        .getPdfJob({
          params: {
            entryId: input.entryId,
            id: input.applicationId,
            jobId: input.jobId,
          },
        })
        .pipe(dataError('read-pdf-job'))
  )

  const readCurrentPdf = Effect.fn('PreparationRepository.readCurrentPdf')(
    function* (input: ReadCurrentPdfInput) {
      const read = (rendererVersion?: string) => {
        const params = {
          entryId: input.entryId,
          id: input.applicationId,
        }
        const query = rendererVersion === undefined ? {} : { rendererVersion }
        return Effect.all({
          artifact: registry.publications.getCurrentPdfArtifact({
            params,
            query,
          }),
          bytes: registry.publications.readCurrentPdfArtifact({
            params,
            query,
          }),
        })
      }
      return yield* input.rendererVersion === undefined
        ? read()
        : read(input.rendererVersion).pipe(
            Effect.catchTag('NotFoundError', () => read())
          )
    },
    (effect) => effect.pipe(dataError('read-current-pdf'))
  )

  return {
    loadCvPageState,
    readCurrentPdf,
    readPdfJob,
    setPublicationAvailability,
    startPdfGeneration,
    stageCv,
  }
}
