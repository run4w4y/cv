import { Effect, Result } from 'effect'

import {
  AnnotationsService,
  type AppendApplicationEventInput,
  ApplicationsService,
  CompensationsService,
  EventsService,
} from '../../src'
import { makeApplicationInput, recordedAt } from '../support/inputs'

export const concurrentNoteWorkflow = Effect.gen(function* () {
  const annotations = yield* AnnotationsService
  const applications = yield* ApplicationsService
  const events = yield* EventsService
  const application = yield* applications.upsert(
    makeApplicationInput('concurrent-note')
  )
  const request = {
    body: 'Only one copy of this concurrent note may be stored.',
    kind: 'general' as const,
    operationId: 'service:concurrent-note',
    source: 'service-integration',
  }
  const results = yield* Effect.all(
    [
      annotations.addNote(application.id, request),
      annotations.addNote(application.id, request),
    ],
    { concurrency: 'unbounded' }
  )
  const storedAnnotations = yield* annotations.list(application.id)
  const storedEvents = yield* events.listByApplication(application.id)

  return {
    applicationId: application.id,
    noteIds: results.map(({ note }) => note.id),
    replayed: results.map((result) => result.replayed),
    storedNoteCount: storedAnnotations.notes.length,
    storedNoteEventCount: storedEvents.items.filter(
      ({ kind }) => kind === 'note_added'
    ).length,
  }
})

const upsertRace = (index: number) =>
  Effect.gen(function* () {
    const annotations = yield* AnnotationsService
    const applications = yield* ApplicationsService
    const compensations = yield* CompensationsService
    const suffix = `concurrent-upsert-${index}`
    const populated = {
      ...makeApplicationInput(suffix),
      compensations: [
        {
          currencyCode: 'EUR' as const,
          kind: 'base_salary' as const,
          maximumMinor: 12_000_000,
          minimumMinor: 10_000_000,
          period: 'year' as const,
          rawText: null,
          source: 'service-integration',
        },
      ],
      labels: [`populated-${index}`],
      role: `Populated concurrent role ${index}`,
    }
    const cleared = {
      ...populated,
      compensations: [],
      labels: [],
      role: `Cleared concurrent role ${index}`,
    }

    const responses = yield* Effect.all(
      [applications.upsert(populated), applications.upsert(cleared)],
      { concurrency: 'unbounded' }
    )
    const stored = yield* applications.find(populated.jobKey)
    const storedAnnotations = yield* annotations.list(stored.id)
    const storedCompensations = yield* compensations.listByApplication(
      stored.id
    )

    return {
      childStateMatchesWinner:
        stored.role === cleared.role
          ? storedAnnotations.labels.length === 0 &&
            storedCompensations.items.length === 0
          : stored.role === populated.role &&
            storedAnnotations.labels.map(({ label }) => label).join(',') ===
              populated.labels.join(',') &&
            storedCompensations.items.length === populated.compensations.length,
      responseApplicationIds: responses.map(({ id }) => id),
      storedApplicationId: stored.id,
    }
  })

export const concurrentUpsertsWorkflow = Effect.forEach(
  Array.from({ length: 6 }, (_, index) => index),
  upsertRace,
  { concurrency: 'unbounded' }
)

export const optimisticPatchRaceWorkflow = Effect.gen(function* () {
  const applications = yield* ApplicationsService
  const application = yield* applications.upsert(
    makeApplicationInput('optimistic-patch-race')
  )
  const attempts = yield* Effect.all(
    [
      Effect.result(
        applications.patch(application.id, {
          applicationStatus: 'applied',
          expectedVersion: application.version,
        })
      ),
      Effect.result(
        applications.patch(application.id, {
          applicationStatus: 'rejected',
          expectedVersion: application.version,
        })
      ),
    ],
    { concurrency: 'unbounded' }
  )
  const current = yield* applications.find(application.id)

  return {
    currentStatus: current.applicationStatus,
    currentVersion: current.version,
    failureTags: attempts
      .filter(Result.isFailure)
      .map(({ failure }) => failure._tag),
    initialVersion: application.version,
    successCount: attempts.filter(Result.isSuccess).length,
  }
})

export const lifecycleRaceWorkflow = Effect.gen(function* () {
  const applications = yield* ApplicationsService
  const events = yield* EventsService
  const application = yield* applications.upsert(
    makeApplicationInput('lifecycle-race')
  )
  const firstRequest: AppendApplicationEventInput = {
    deviceId: 'miniflare',
    expectedVersion: application.version,
    kind: 'stage_changed',
    nextApplicationStatus: 'applied',
    occurredAt: recordedAt,
    operationId: 'service:lifecycle-race:a',
    payload: { applicationStatus: 'applied' },
  }
  const secondRequest: AppendApplicationEventInput = {
    ...firstRequest,
    nextApplicationStatus: 'rejected',
    operationId: 'service:lifecycle-race:b',
    payload: { applicationStatus: 'rejected' },
  }
  const attempts = yield* Effect.all(
    [
      Effect.result(events.append(application.id, firstRequest)),
      Effect.result(events.append(application.id, secondRequest)),
    ],
    { concurrency: 'unbounded' }
  )
  const first = attempts[0]
  const second = attempts[1]
  const winner = Result.isSuccess(first)
    ? first.success
    : Result.isSuccess(second)
      ? second.success
      : null
  if (winner === null) {
    return yield* Effect.die(
      new Error('The lifecycle race did not produce a winner.')
    )
  }
  const winningRequest =
    winner.event.operationId === firstRequest.operationId
      ? firstRequest
      : secondRequest
  const replayed = yield* events.append(application.id, winningRequest)
  const stored = yield* events.listByApplication(application.id)
  const current = yield* applications.find(application.id)

  return {
    currentStatus: current.applicationStatus,
    currentVersion: current.version,
    failureTags: attempts
      .filter(Result.isFailure)
      .map(({ failure }) => failure._tag),
    initialVersion: application.version,
    replayed: replayed.replayed,
    storedOperationIds: stored.items
      .filter(({ operationId }) =>
        operationId.startsWith('service:lifecycle-race:')
      )
      .map(({ operationId }) => operationId),
    successCount: attempts.filter(Result.isSuccess).length,
    winningOperationId: winner.event.operationId,
  }
})
