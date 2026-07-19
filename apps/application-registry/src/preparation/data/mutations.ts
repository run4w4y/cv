import { Effect } from 'effect'
import * as Reactivity from 'effect/unstable/reactivity/Reactivity'

import {
  contentMutationReactivityKeys,
  preparationReactivity,
  publicationMutationReactivityKeys,
} from './keys'
import { PreparationRepository } from './repository'
import { preparationDataRuntime } from './runtime'
import type {
  AppendRevisionInput,
  ApproveRevisionInput,
  ManualJobContextInput,
  ReadCurrentPdfInput,
  SetPublicationAvailabilityInput,
} from './types'

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
    repository.appendRevision(input)
  ).pipe(
    invalidateAfter(contentMutationReactivityKeys(identity, input.entry.id))
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
    repository.approveRevision(input)
  ).pipe(
    invalidateAfter(contentMutationReactivityKeys(identity, input.entry.id))
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

const readCurrentPdf = (input: ReadCurrentPdfInput) =>
  PreparationRepository.use((repository) => repository.readCurrentPdf(input))

export const makeReadCurrentPdfAtom = () =>
  preparationDataRuntime.fn<ReadCurrentPdfInput>()(readCurrentPdf)
