import { uniq } from 'es-toolkit/array'

import type { PreparationRunState } from '../domain'
import { preparationSourceApplicationId, preparationSourceUrl } from '../domain'
import type { PreparationRunReservation, PreparationRunStates } from './model'
import {
  openPreparationStatuses,
  samePreparationIdentity,
  sameRequestedPreparationIdentity,
  startPreparationHistory,
} from './state'

export type PreparationReservationResult = {
  readonly conflict: string | null
  readonly runs: PreparationRunStates
}

export const reservePreparationRuns = (
  current: PreparationRunStates,
  reservations: ReadonlyArray<PreparationRunReservation>,
  createdAt: number
): PreparationReservationResult => {
  for (const [index, reservation] of reservations.entries()) {
    const { input } = reservation
    if (current.has(input.runId)) {
      return {
        conflict: `Preparation run ${input.runId} already exists.`,
        runs: current,
      }
    }

    const precedingReservations = reservations.slice(0, index)
    if (
      precedingReservations.some(
        ({ input: requested }) => requested.runId === input.runId
      )
    ) {
      return {
        conflict: `Preparation run ${input.runId} is duplicated within this batch.`,
        runs: current,
      }
    }

    const requestedConflict = precedingReservations.find(
      ({ input: requested }) =>
        sameRequestedPreparationIdentity(input, requested)
    )
    if (requestedConflict !== undefined) {
      return {
        conflict: `Preparation run ${requestedConflict.input.runId} is duplicated within this batch.`,
        runs: current,
      }
    }

    const existingConflict = [...current.values()].find(
      (run) =>
        openPreparationStatuses.has(run.status) &&
        samePreparationIdentity(input, run)
    )
    if (existingConflict !== undefined) {
      return {
        conflict: `Preparation run ${existingConflict.runId} is already open for this application, document kind, and locale.`,
        runs: current,
      }
    }
  }

  const runs = new Map(current)
  for (const { batchId, batchPosition, input } of reservations) {
    const message = 'Waiting for a preparation slot.'
    runs.set(input.runId, {
      applicationId: preparationSourceApplicationId(input.source),
      batchId,
      batchPosition,
      candidate: null,
      createdAt,
      error: null,
      executionId: null,
      kind: input.kind,
      locale: input.locale,
      message,
      reviewToken: null,
      runId: input.runId,
      stage: 'queued',
      status: 'queued',
      stepHistory: startPreparationHistory(message, createdAt),
      updatedAt: createdAt,
      url: preparationSourceUrl(input.source),
    })
  }
  return { conflict: null, runs }
}

export const releasePreparationReservations = (
  current: PreparationRunStates,
  runIds: ReadonlyArray<string>
): PreparationRunStates => {
  let runs: Map<string, PreparationRunState> | null = null
  for (const runId of uniq(runIds)) {
    const run = current.get(runId)
    if (
      run === undefined ||
      run.status !== 'queued' ||
      run.executionId !== null
    ) {
      continue
    }
    runs ??= new Map(current)
    runs.delete(runId)
  }
  return runs ?? current
}
