import type { CvLink, GeneratedArtifact } from '@cv/application-registry-entity'
import { Effect } from 'effect'

import type { RegistryClient } from '../../../lib/registry-client'
import type { PublicationIdentity } from '../keys'
import type {
  PublishCvInput,
  PublishedCvState,
  ReadCurrentPdfInput,
  ReadPdfJobInput,
  SetPublicationAvailabilityInput,
  StartPdfGenerationInput,
} from '../types'
import { dataError } from './shared'

export const makePreparationPublicationRepository = (
  registry: RegistryClient['Service']
) => {
  const currentPdfArtifact = Effect.fn(
    'PreparationRepository.currentPdfArtifact'
  )((identity: PublicationIdentity) => {
    const read = (rendererVersion?: string) =>
      registry.registry.getCurrentPdfArtifact({
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

  const loadPublishedCvState = Effect.fn(
    'PreparationRepository.loadPublishedCvState'
  )(
    function* (identity: PublicationIdentity) {
      type LoadedPublication = {
        readonly artifact: GeneratedArtifact
        readonly link: CvLink
      }
      const loaded = yield* Effect.all(
        {
          artifact: currentPdfArtifact(identity),
          link: registry.registry.getCvLink({
            params: {
              entryId: identity.entryId,
              id: identity.applicationId,
            },
          }),
        },
        { concurrency: 2 }
      ).pipe(
        Effect.map((value): LoadedPublication | null => value),
        Effect.catchTag('NotFoundError', () =>
          Effect.succeed<LoadedPublication | null>(null)
        )
      )
      if (loaded === null) return null
      return loaded.artifact.status === 'ready' &&
        loaded.artifact.cvLinkId === loaded.link.id &&
        loaded.artifact.publicationVersion === loaded.link.publicationVersion &&
        loaded.artifact.qrTarget === loaded.link.publicUrl
        ? ({
            artifact: loaded.artifact,
            link: loaded.link,
          } satisfies PublishedCvState)
        : null
    },
    (effect) => effect.pipe(dataError('load-published-cv'))
  )

  const publishCv = Effect.fn('PreparationRepository.publishCv')(
    (input: PublishCvInput) =>
      registry.registry
        .publishCv({
          params: {
            entryId: input.entry.id,
            id: input.applicationId,
          },
          payload: {
            expectedContentVersion: input.entry.version,
            publicBaseUrl: input.publicBaseUrl,
          },
        })
        .pipe(dataError('publish-cv'))
  )

  const setPublicationAvailability = Effect.fn(
    'PreparationRepository.setPublicationAvailability'
  )((input: SetPublicationAvailabilityInput) =>
    registry.registry
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
    registry.registry
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
      registry.registry
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
      const read = (rendererVersion?: string) =>
        registry.registry.readCurrentPdfArtifact({
          params: {
            entryId: input.entryId,
            id: input.applicationId,
          },
          query: rendererVersion === undefined ? {} : { rendererVersion },
        })
      return yield* input.rendererVersion === undefined
        ? read()
        : read(input.rendererVersion).pipe(
            Effect.catchTag('NotFoundError', () => read())
          )
    },
    (effect) => effect.pipe(dataError('read-current-pdf'))
  )

  return {
    loadPublishedCvState,
    publishCv,
    readCurrentPdf,
    readPdfJob,
    setPublicationAvailability,
    startPdfGeneration,
  }
}
