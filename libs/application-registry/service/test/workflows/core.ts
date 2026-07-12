import { Effect, Result } from 'effect'

import {
  AnnotationsService,
  type AppendApplicationEventInput,
  ApplicationsService,
  CapturesService,
  CompensationsService,
  EventsService,
} from '../../src'
import {
  makeApplicationInput,
  makeCaptureInput,
  recordedAt,
} from '../support/inputs'

export const applicationWorkflow = Effect.gen(function* () {
  const applications = yield* ApplicationsService
  const annotations = yield* AnnotationsService
  const created = yield* applications.upsert(
    makeApplicationInput('application')
  )
  const initialPage = yield* applications.list({ limit: 10 })
  const patched = yield* applications.patch(created.id, {
    expectedVersion: created.version,
    fitScore: 91,
    recommendedAction: 'Apply this week',
  })
  const labels = yield* applications.replaceLabels(created.id, [
    'priority',
    'remote',
    'priority',
  ])
  const delta = yield* applications.list({
    after: initialPage.checkpoint ?? undefined,
    limit: 10,
  })
  const storedAnnotations = yield* annotations.list(created.id)

  return {
    checkpoint: initialPage.checkpoint,
    created: {
      applicationStatus: created.applicationStatus,
      id: created.id,
      version: created.version,
    },
    deltaIds: delta.items.map(({ id }) => id),
    labels: labels.map(({ label }) => label),
    patched: {
      fitScore: patched.fitScore,
      recommendedAction: patched.recommendedAction,
      version: patched.version,
    },
    storedLabels: storedAnnotations.labels.map(({ label }) => label),
  }
})

export const eventWorkflow = Effect.gen(function* () {
  const applications = yield* ApplicationsService
  const events = yield* EventsService
  const created = yield* applications.upsert(makeApplicationInput('event'))
  const request: AppendApplicationEventInput = {
    deviceId: 'miniflare',
    expectedVersion: created.version,
    kind: 'stage_changed',
    nextApplicationStatus: 'technical_screen',
    occurredAt: recordedAt,
    operationId: 'service:event:1',
    payload: { stage: 'technical_screen' },
  }
  const appended = yield* events.append(created.id, request)
  const replayed = yield* events.append(created.id, request)
  const conflict = yield* Effect.result(
    events.append(created.id, {
      ...request,
      nextApplicationStatus: 'rejected',
      payload: { stage: 'rejected' },
    })
  )
  const stored = yield* events.listByApplication(created.id)

  return {
    applicationStatus: appended.application.applicationStatus,
    applicationVersion: appended.application.version,
    conflictTag: Result.isFailure(conflict) ? conflict.failure._tag : null,
    eventIdsMatch: appended.event.id === replayed.event.id,
    firstReplayed: appended.replayed,
    replayed: replayed.replayed,
    storedEventOperationIds: stored.items.map(({ operationId }) => operationId),
  }
})

export const noteAndCaptureWorkflow = Effect.gen(function* () {
  const annotations = yield* AnnotationsService
  const applications = yield* ApplicationsService
  const captures = yield* CapturesService
  const input = makeApplicationInput('note-and-capture')
  const created = yield* applications.upsert(input)
  const noteRequest = {
    body: 'Follow up after the technical screen.',
    kind: 'general' as const,
    operationId: 'service:note:1',
    source: 'service-integration',
  }
  const note = yield* annotations.addNote(created.id, noteRequest)
  const replayedNote = yield* annotations.addNote(created.id, noteRequest)
  const noteConflict = yield* Effect.result(
    annotations.addNote(created.id, {
      ...noteRequest,
      body: 'This is another command using the same operation ID.',
    })
  )
  const captureRequest = makeCaptureInput(
    'note-and-capture',
    'service:capture:1'
  )
  const capture = yield* captures.capture(captureRequest)
  const replayedCapture = yield* captures.capture(captureRequest)
  const storedNotes = yield* annotations.list(created.id)
  const storedCaptures = yield* captures.listByApplication(created.id)

  return {
    captureIdsMatch: capture.capture.id === replayedCapture.capture.id,
    captureReplayed: capture.replayed,
    noteConflictTag: Result.isFailure(noteConflict)
      ? noteConflict.failure._tag
      : null,
    noteIdsMatch: note.note.id === replayedNote.note.id,
    noteReplayed: note.replayed,
    replayedCapture: replayedCapture.replayed,
    replayedNote: replayedNote.replayed,
    storedCaptureCount: storedCaptures.items.length,
    storedNoteCount: storedNotes.notes.length,
  }
})

export const compensationWorkflow = Effect.gen(function* () {
  const applications = yield* ApplicationsService
  const compensations = yield* CompensationsService
  const created = yield* applications.upsert({
    ...makeApplicationInput('compensation'),
    compensations: [
      {
        currencyCode: 'EUR',
        kind: 'base_salary',
        maximumMinor: 12_000_000,
        minimumMinor: 10_000_000,
        period: 'year',
        rawText: null,
        source: 'service-integration',
      },
    ],
  })
  const result = yield* compensations.listByApplication(created.id, 'USD')
  const item = result.items.at(0)

  return {
    conversion: item?.conversion ?? null,
    originalCurrency: item?.original.currencyCode ?? null,
  }
})

export const defaultsWorkflow = Effect.gen(function* () {
  const applications = yield* ApplicationsService
  const captures = yield* CapturesService
  const created = yield* applications.upsert({
    canonicalUrl: 'https://example.test/jobs/database-defaults',
    company: 'Database Defaults Company',
    jobKey: 'service:database-defaults',
    location: null,
    role: 'Database Defaults Engineer',
    source: 'service-integration',
    sourceJobId: null,
  })
  const captured = yield* captures.capture(
    makeCaptureInput('capture-defaults', 'service:capture-defaults')
  )

  return {
    captureStatus: captured.application.applicationStatus,
    created: {
      applicationStatus: created.applicationStatus,
      category: created.category,
      fitScore: created.fitScore,
      targetStage: created.targetStage,
      version: created.version,
    },
  }
})

export const patchNullabilityWorkflow = Effect.gen(function* () {
  const applications = yield* ApplicationsService
  const details = {
    applyFromAbroad: 'Yes',
    countryCode: 'JP' as const,
    employmentType: 'full-time',
    languageRequirements: ['English'],
    region: 'Kanto',
    relocationSupport: 'Available',
    remoteRegion: 'Worldwide',
    residenceRequirement: null,
    timezoneOverlap: 'JST overlap',
    visaSponsorship: 'Case by case',
    workAuthorization: 'Not required when applying',
    workMode: 'remote',
  }
  const created = yield* applications.upsert({
    ...makeApplicationInput('patch-nullability'),
    category: 'Backend',
    details,
    followUpAt: '2026-07-20T12:00:00.000Z',
    personalPriority: 'high',
  })
  const partiallyUpdated = yield* applications.patch(created.id, {
    fitScore: 42,
  })
  const cleared = yield* applications.patch(created.id, {
    category: null,
    details: null,
    followUpAt: null,
    personalPriority: null,
  })

  return {
    cleared: {
      category: cleared.category,
      details: cleared.details,
      fitScore: cleared.fitScore,
      followUpAt: cleared.followUpAt,
      personalPriority: cleared.personalPriority,
    },
    partiallyUpdated: {
      category: partiallyUpdated.category,
      details: partiallyUpdated.details,
      fitScore: partiallyUpdated.fitScore,
      followUpAt: partiallyUpdated.followUpAt,
      personalPriority: partiallyUpdated.personalPriority,
    },
  }
})

export const captureMergeWorkflow = Effect.gen(function* () {
  const applications = yield* ApplicationsService
  const captures = yield* CapturesService
  const existing = yield* applications.upsert({
    ...makeApplicationInput('capture-merge'),
    location: 'Existing enriched location',
    sourceJobId: 'existing-source-job-id',
    targetStage: 'verify_first',
  })
  const captured = yield* captures.capture({
    ...makeCaptureInput('capture-merge', 'service:capture-merge'),
    location: null,
    sourceJobId: null,
    targetStage: 'apply_next',
  })
  const backlog = yield* applications.upsert({
    ...makeApplicationInput('capture-backlog'),
    targetStage: 'backlog',
  })
  const promoted = yield* captures.capture({
    ...makeCaptureInput('capture-backlog', 'service:capture-backlog'),
    targetStage: 'apply_next',
  })
  const explicitlyReplaced = yield* applications.upsert({
    ...makeApplicationInput('capture-merge'),
    location: null,
    sourceJobId: null,
    targetStage: 'secondary',
  })

  return {
    backlogId: backlog.id,
    captured: {
      id: captured.application.id,
      location: captured.application.location,
      sourceJobId: captured.application.sourceJobId,
      targetStage: captured.application.targetStage,
    },
    existingId: existing.id,
    explicitlyReplaced: {
      location: explicitlyReplaced.location,
      sourceJobId: explicitlyReplaced.sourceJobId,
      targetStage: explicitlyReplaced.targetStage,
    },
    promoted: {
      id: promoted.application.id,
      targetStage: promoted.application.targetStage,
    },
  }
})
