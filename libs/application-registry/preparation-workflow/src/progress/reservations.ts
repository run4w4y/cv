import { uniq } from 'es-toolkit/array'

import type { PreparationRunState, PreparationWorkflowInput } from '../domain'
import { preparationSourceApplicationId, preparationSourceUrl } from '../domain'
import type { PreparationRunStates } from './model'
import {
  openPreparationStatuses,
  samePreparationIdentity,
  sameRequestedPreparationIdentity,
} from './state'

export type PreparationReservationResult = {
  readonly conflict: string | null
  readonly runs: PreparationRunStates
}

export const reservePreparationRuns = (
  current: PreparationRunStates,
  inputs: ReadonlyArray<PreparationWorkflowInput>
): PreparationReservationResult => {
  for (const [index, input] of inputs.entries()) {
    if (current.has(input.runId)) {
      return {
        conflict: `Preparation run ${input.runId} already exists.`,
        runs: current,
      }
    }

    const precedingInputs = inputs.slice(0, index)
    if (precedingInputs.some((requested) => requested.runId === input.runId)) {
      return {
        conflict: `Preparation run ${input.runId} is duplicated within this batch.`,
        runs: current,
      }
    }

    const requestedConflict = precedingInputs.find((requested) =>
      sameRequestedPreparationIdentity(input, requested)
    )
    if (requestedConflict !== undefined) {
      return {
        conflict: `Preparation run ${requestedConflict.runId} is duplicated within this batch.`,
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
  for (const input of inputs) {
    runs.set(input.runId, {
      applicationId: preparationSourceApplicationId(input.source),
      candidate: null,
      error: null,
      executionId: null,
      kind: input.kind,
      locale: input.locale,
      message: 'Waiting for a preparation slot.',
      reviewToken: null,
      runId: input.runId,
      stage: 'queued',
      status: 'queued',
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
