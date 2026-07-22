import type { ContentRevisionResultResponse } from '@cv/application-registry-api-contract'
import { Effect } from 'effect'
import * as Reactivity from 'effect/unstable/reactivity/Reactivity'

import { publicCvBaseUrl } from '@/preparation/config'
import {
  contentMutationReactivityKeys,
  type PublicationIdentity,
  preparationReactivity,
  publicationMutationReactivityKeys,
} from './keys'
import { PreparationRepository } from './repository'
import { preparationDataRuntime } from './runtime'
import type {
  AppendRevisionInput,
  ApproveRevisionInput,
  ManualJobContextInput,
  PreparationRepositoryShape,
  ReadCurrentPdfInput,
  RequestPdfGenerationInput,
  SetPublicationAvailabilityInput,
} from './types'

const stageCvRevision = (
  repository: PreparationRepositoryShape,
  applicationId: string,
  result: ContentRevisionResultResponse
) =>
  result.entry.kind === 'cv'
    ? repository
        .stageCv({
          applicationId,
          entry: result.entry,
          operationId: result.revision.operationId,
          publicBaseUrl: publicCvBaseUrl(),
          revisionId: result.revision.id,
        })
        .pipe(Effect.as(result))
    : Effect.succeed(result)

const invalidateAfter =
  (keys: ReadonlyArray<unknown>) =>
  <A, E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, E, R | Reactivity.Reactivity> =>
    effect.pipe(Effect.tap(() => Reactivity.invalidate(keys)))

const refreshJobSnapshot = (applicationId: string) =>
  PreparationRepository.use((repository) =>
    repository.refreshSnapshot(applicationId)
  ).pipe(
    invalidateAfter([
      preparationReactivity.application(applicationId),
      preparationReactivity.snapshot(applicationId),
    ])
  )

export const makeRefreshJobSnapshotAtom = () =>
  preparationDataRuntime.fn<string>()(refreshJobSnapshot)

const persistManualJobContext = (input: ManualJobContextInput) =>
  PreparationRepository.use((repository) =>
    repository.persistManualJobContext(input)
  ).pipe(
    invalidateAfter([
      preparationReactivity.application(input.applicationId),
      preparationReactivity.snapshot(input.applicationId),
    ])
  )

export const makePersistManualJobContextAtom = () =>
  preparationDataRuntime.fn<ManualJobContextInput>()(persistManualJobContext)

const appendPreparationRevision = (input: AppendRevisionInput) => {
  const identity = {
    applicationId: input.applicationId,
    kind: input.entry.kind,
    locale: input.entry.locale,
  } as const
  return PreparationRepository.use((repository) =>
    repository
      .appendRevision(input)
      .pipe(
        Effect.flatMap((result) =>
          stageCvRevision(repository, input.applicationId, result)
        )
      )
  ).pipe(
    invalidateAfter([
      ...contentMutationReactivityKeys(identity, input.entry.id),
      ...(input.entry.kind === 'cv'
        ? publicationMutationReactivityKeys(input.applicationId, input.entry.id)
        : []),
    ])
  )
}

export const makeAppendPreparationRevisionAtom = () =>
  preparationDataRuntime.fn<AppendRevisionInput>()(appendPreparationRevision)

const approvePreparationRevision = (input: ApproveRevisionInput) => {
  const identity = {
    applicationId: input.applicationId,
    kind: input.entry.kind,
    locale: input.entry.locale,
  } as const
  return PreparationRepository.use((repository) =>
    repository
      .approveRevision(input)
      .pipe(
        Effect.flatMap((result) =>
          stageCvRevision(repository, input.applicationId, result)
        )
      )
  ).pipe(
    invalidateAfter([
      ...contentMutationReactivityKeys(identity, input.entry.id),
      ...(input.entry.kind === 'cv'
        ? publicationMutationReactivityKeys(input.applicationId, input.entry.id)
        : []),
    ])
  )
}

export const makeApprovePreparationRevisionAtom = () =>
  preparationDataRuntime.fn<ApproveRevisionInput>()(approvePreparationRevision)

const setPublicationAvailability = (input: SetPublicationAvailabilityInput) =>
  PreparationRepository.use((repository) =>
    repository.setPublicationAvailability(input)
  ).pipe(
    invalidateAfter(
      publicationMutationReactivityKeys(input.applicationId, input.entryId)
    )
  )

export const makeSetPublicationAvailabilityAtom = () =>
  preparationDataRuntime.fn<SetPublicationAvailabilityInput>()(
    setPublicationAvailability
  )

const requestPdfGeneration = (input: RequestPdfGenerationInput) =>
  PreparationRepository.use((repository) =>
    repository.requestPdfGeneration(input)
  ).pipe(
    invalidateAfter(
      publicationMutationReactivityKeys(input.applicationId, input.entryId)
    )
  )

export const makeRequestPdfGenerationAtom = () =>
  preparationDataRuntime.fn<RequestPdfGenerationInput>()(requestPdfGeneration)

const refreshCvPage = (input: PublicationIdentity) =>
  Reactivity.invalidate(
    publicationMutationReactivityKeys(input.applicationId, input.entryId)
  )

export const makeRefreshCvPageAtom = () =>
  preparationDataRuntime.fn<PublicationIdentity>()(refreshCvPage)

const readCurrentPdf = (input: ReadCurrentPdfInput) =>
  PreparationRepository.use((repository) => repository.readCurrentPdf(input))

export const makeReadCurrentPdfAtom = () =>
  preparationDataRuntime.fn<ReadCurrentPdfInput>()(readCurrentPdf)
