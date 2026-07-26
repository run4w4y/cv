import { uniq } from 'es-toolkit/array'

import type {
  DocumentKind,
  PreparationArtifactState,
  PreparationJobState,
} from '../domain'
import { aiWorkflowTargetApplicationId, aiWorkflowTargetUrl } from '../domain'
import type { PreparationJobReservation, PreparationJobStates } from './model'
import {
  openPreparationStatuses,
  samePreparationIdentity,
  sameRequestedPreparationIdentity,
  startSharedHistory,
} from './state'

export type PreparationReservationResult = {
  readonly conflict: string | null
  readonly jobs: PreparationJobStates
}

const queuedArtifact = (
  kind: DocumentKind,
  createdAt: number
): PreparationArtifactState => ({
  candidate: null,
  error: null,
  history: [],
  kind,
  message: 'Waiting for shared job analysis.',
  reviewToken: null,
  stage: null,
  status: 'queued',
  updatedAt: createdAt,
})

export const reservePreparationJobs = (
  current: PreparationJobStates,
  reservations: ReadonlyArray<PreparationJobReservation>,
  createdAt: number
): PreparationReservationResult => {
  for (const [index, reservation] of reservations.entries()) {
    const { input } = reservation
    if (current.has(input.jobId)) {
      return {
        conflict: `AI workflow job ${input.jobId} already exists.`,
        jobs: current,
      }
    }

    const precedingReservations = reservations.slice(0, index)
    if (
      precedingReservations.some(
        ({ input: requested }) => requested.jobId === input.jobId
      )
    ) {
      return {
        conflict: `AI workflow job ${input.jobId} is duplicated within this batch.`,
        jobs: current,
      }
    }

    const requestedConflict = precedingReservations.find(
      ({ input: requested }) =>
        sameRequestedPreparationIdentity(input, requested)
    )
    if (requestedConflict !== undefined) {
      return {
        conflict: `The target for AI workflow job ${requestedConflict.input.jobId} is duplicated within this batch.`,
        jobs: current,
      }
    }

    const existingConflict = [...current.values()].find(
      (job) =>
        openPreparationStatuses.has(job.status) &&
        samePreparationIdentity(input, job)
    )
    if (existingConflict !== undefined) {
      return {
        conflict: `AI workflow job ${existingConflict.jobId} is already open for this target and locale.`,
        jobs: current,
      }
    }
  }

  const jobs = new Map(current)
  for (const { batchId, batchPosition, input, retryOfJobId } of reservations) {
    const message = 'Waiting for an AI workflow slot.'
    jobs.set(input.jobId, {
      applicationId: aiWorkflowTargetApplicationId(input.target),
      artifacts: {
        coverLetter:
          input.artifacts.coverLetter === null
            ? null
            : queuedArtifact('cover_letter', createdAt),
        cv:
          input.artifacts.cv === null ? null : queuedArtifact('cv', createdAt),
      },
      batchId,
      batchPosition,
      company: null,
      createdAt,
      error: null,
      executionId: null,
      input,
      jobId: input.jobId,
      locale: input.locale,
      message,
      retryOfJobId,
      role: null,
      shared: {
        history: startSharedHistory(message, createdAt),
        stage: 'queued',
        status: 'running',
      },
      status: 'queued',
      target: input.target,
      updatedAt: createdAt,
      url: aiWorkflowTargetUrl(input.target),
    })
  }
  return { conflict: null, jobs }
}

export const releasePreparationReservations = (
  current: PreparationJobStates,
  jobIds: ReadonlyArray<string>
): PreparationJobStates => {
  let jobs: Map<string, PreparationJobState> | null = null
  for (const jobId of uniq(jobIds)) {
    const job = current.get(jobId)
    if (
      job === undefined ||
      job.status !== 'queued' ||
      job.executionId !== null
    ) {
      continue
    }
    jobs ??= new Map(current)
    jobs.delete(jobId)
  }
  return jobs ?? current
}
