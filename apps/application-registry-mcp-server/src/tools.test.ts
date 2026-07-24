import { describe, expect, test } from 'bun:test'
import type {
  AddApplicationNoteRequest,
  ApplicationListItem,
  UpdateApplicationRequest,
} from '@cv/application-registry-api-contract'
import type {
  Application,
  ApplicationNote,
} from '@cv/application-registry-entity'
import { BunServices } from '@effect/platform-bun'
import { Context, Effect } from 'effect'
import { Tool } from 'effect/unstable/ai'

import { ApplicationRegistryToolError } from './errors'
import {
  ApplicationRegistryGateway,
  type ApplicationRegistryGatewayService,
} from './gateway'
import {
  ApplicationRegistryToolkit,
  makeApplicationRegistryToolkitHandlers,
} from './tools'

const application: Application = {
  applicationStatus: 'preparing',
  appliedAt: null,
  company: 'Example',
  createdAt: '2026-07-10T00:00:00.000Z',
  followUpAt: null,
  id: 'application-1',
  listingAvailability: 'unchecked',
  listingCheckedAt: null,
  listingClosedCandidateAt: null,
  listingConfidence: null,
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  location: null,
  personalPriority: null,
  postingUrl: 'https://example.test/jobs/one',
  role: 'Engineer',
  targetStage: 'backlog',
  updatedAt: '2026-07-10T00:00:00.000Z',
  updatedRevision: 1,
  version: 1,
}

const listItem: ApplicationListItem = {
  ...application,
  annualCompensation: null,
  counts: { notes: 0 },
  labels: [],
  latestActivity: null,
}

const page = {
  items: [listItem],
  pageInfo: {
    kind: 'cursor' as const,
    size: 20,
    hasNextPage: false,
    hasPreviousPage: false,
    nextCursor: null,
  },
}

const note: ApplicationNote = {
  applicationId: application.id,
  body: 'Gmail correspondence',
  createdAt: '2026-07-10T01:00:00.000Z',
  id: 'note-1',
  kind: 'contact',
  source: 'gmail',
  updatedAt: '2026-07-10T01:00:00.000Z',
}

const gateway = (
  overrides: Partial<ApplicationRegistryGatewayService> = {}
): ApplicationRegistryGatewayService => ({
  addNote: () => Effect.succeed({ note, replayed: false }),
  create: (request) =>
    Effect.succeed({
      ...application,
      company: request.company,
      location: request.location,
      postingUrl: request.postingUrl,
      role: request.role,
    }),
  listActivities: () => Effect.succeed({ items: [] }),
  listAnnotations: () => Effect.succeed({ labels: [], notes: [] }),
  list: () => Effect.succeed(page),
  show: () => Effect.succeed(application),
  update: () =>
    Effect.succeed({
      annualCompensation: null,
      application: { ...application, version: application.version + 1 },
      labels: [],
    }),
  ...overrides,
})

const handlers = (service: ApplicationRegistryGatewayService) =>
  makeApplicationRegistryToolkitHandlers.pipe(
    Effect.provideService(
      ApplicationRegistryGateway,
      ApplicationRegistryGateway.of(service)
    ),
    Effect.provide(BunServices.layer)
  )

describe('application registry MCP tools', () => {
  test('publishes model-friendly schemas and mutation hints', () => {
    const tools = ApplicationRegistryToolkit.tools
    expect(Object.keys(tools)).toEqual([
      'search_applications',
      'get_application',
      'list_application_activities',
      'list_application_annotations',
      'create_application',
      'update_application',
      'record_application_correspondence',
    ])

    const createSchema = Tool.getJsonSchema(tools.create_application)
    expect(createSchema.required).toContain('postingUrl')
    expect(createSchema.required).not.toContain('applicationStatus')
    expect(
      Context.get(tools.search_applications.annotations, Tool.Readonly)
    ).toBe(true)
    expect(
      Context.get(tools.update_application.annotations, Tool.Destructive)
    ).toBe(true)
    expect(
      Context.get(tools.update_application.annotations, Tool.OpenWorld)
    ).toBe(false)
    expect(
      Context.get(
        tools.record_application_correspondence.annotations,
        Tool.Idempotent
      )
    ).toBe(true)
  })

  test('translates simple search parameters to the registry query contract', async () => {
    let observedQuery:
      | Parameters<ApplicationRegistryGatewayService['list']>[0]
      | undefined
    const service = gateway({
      list: (query) => {
        observedQuery = query
        return Effect.succeed(page)
      },
    })
    const result = await Effect.runPromise(
      handlers(service).pipe(
        Effect.flatMap((value) =>
          value.search_applications({
            applicationStatus: 'preparing',
            limit: 7,
            query: 'Example',
            targetStage: 'backlog',
          })
        )
      )
    )

    expect(result).toEqual(page)
    expect(observedQuery).toEqual({
      filters: [
        {
          type: 'condition',
          field: 'q',
          operator: 'matches',
          value: 'Example',
        },
        {
          type: 'condition',
          field: 'applicationStatus',
          operator: 'eq',
          value: 'preparing',
        },
        {
          type: 'condition',
          field: 'targetStage',
          operator: 'eq',
          value: 'backlog',
        },
      ],
      pagination: { size: 7 },
    })
  })

  test('generates an operation ID and forwards optimistic concurrency', async () => {
    let observed:
      | {
          readonly identifier: string
          readonly operationId: string
          readonly request: UpdateApplicationRequest
        }
      | undefined
    const service = gateway({
      update: (identifier, operationId, request) => {
        observed = { identifier, operationId, request }
        return Effect.succeed({
          annualCompensation: null,
          application: { ...application, role: 'Staff Engineer', version: 2 },
          labels: [],
        })
      },
    })
    const result = await Effect.runPromise(
      handlers(service).pipe(
        Effect.flatMap((value) =>
          value.update_application({
            identifier: application.id,
            expectedVersion: application.version,
            role: 'Staff Engineer',
          })
        )
      )
    )

    if (observed === undefined) throw new Error('Expected an update request.')
    expect(observed.identifier).toBe(application.id)
    expect(observed.request).toEqual({
      expectedVersion: application.version,
      role: 'Staff Engineer',
    })
    expect(result.operationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
    )
    expect(result.operationId).toBe(observed.operationId)
  })

  test('rejects an empty update before calling the registry', async () => {
    let called = false
    const service = gateway({
      update: () => {
        called = true
        return Effect.die('unexpected registry call')
      },
    })
    const exit = await Effect.runPromiseExit(
      handlers(service).pipe(
        Effect.flatMap((value) =>
          value.update_application({
            identifier: application.id,
            expectedVersion: application.version,
          })
        )
      )
    )

    expect(called).toBe(false)
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Failure') {
      expect(String(exit.cause)).toContain(
        'Supply at least one application field to update.'
      )
    }
  })

  test('delegates application history reads to the gateway', async () => {
    const calls: string[] = []
    const service = gateway({
      listActivities: (identifier) => {
        calls.push(`activities:${identifier}`)
        return Effect.succeed({ items: [] })
      },
      listAnnotations: (identifier) => {
        calls.push(`annotations:${identifier}`)
        return Effect.succeed({ labels: [], notes: [note] })
      },
    })
    const result = await Effect.runPromise(
      handlers(service).pipe(
        Effect.flatMap((value) =>
          Effect.all({
            activities: value.list_application_activities({
              identifier: application.id,
            }),
            annotations: value.list_application_annotations({
              identifier: application.id,
            }),
          })
        )
      )
    )

    expect(calls).toEqual([
      `activities:${application.id}`,
      `annotations:${application.id}`,
    ])
    expect(result).toEqual({
      activities: { items: [] },
      annotations: { labels: [], notes: [note] },
    })
  })

  test('records correspondence and advances status using the post-note version', async () => {
    const calls: Array<
      | {
          readonly type: 'note'
          readonly identifier: string
          readonly operationId: string
          readonly request: AddApplicationNoteRequest
        }
      | {
          readonly type: 'update'
          readonly identifier: string
          readonly operationId: string
          readonly request: UpdateApplicationRequest
        }
    > = []
    let showCount = 0
    const afterNote = { ...application, version: 2 }
    const afterUpdate = {
      ...afterNote,
      applicationStatus: 'technical_screen' as const,
      appliedAt: '2026-07-08T09:30:00.000Z',
      version: 3,
    }
    const service = gateway({
      addNote: (identifier, operationId, request) => {
        calls.push({ identifier, operationId, request, type: 'note' })
        return Effect.succeed({ note, replayed: false })
      },
      show: () => Effect.succeed(showCount++ === 0 ? application : afterNote),
      update: (identifier, operationId, request) => {
        calls.push({ identifier, operationId, request, type: 'update' })
        return Effect.succeed({
          annualCompensation: null,
          application: afterUpdate,
          labels: [],
        })
      },
    })

    const result = await Effect.runPromise(
      handlers(service).pipe(
        Effect.flatMap((value) =>
          value.record_application_correspondence({
            appliedAt: '2026-07-08T09:30:00.000Z',
            classification: 'technical_screen_scheduled',
            evidenceSummary: 'Technical interview invitation for July 14.',
            expectedVersion: 1,
            gmailMessageId: 'message-123',
            gmailThreadId: 'thread-456',
            identifier: application.id,
            occurredAt: '2026-07-10T01:00:00.000Z',
            operationId: 'gmail:message-123:application-1:technical',
          })
        )
      )
    )

    expect(calls).toEqual([
      {
        identifier: application.id,
        operationId: 'gmail:message-123:application-1:technical:note',
        request: {
          body: [
            'Gmail correspondence',
            'Gmail message ID: message-123',
            'Gmail thread ID: thread-456',
            'Occurred at: 2026-07-10T01:00:00.000Z',
            'Classification: technical_screen_scheduled',
            'Evidence: Technical interview invitation for July 14.',
          ].join('\n'),
          kind: 'contact',
          source: 'gmail',
        },
        type: 'note',
      },
      {
        identifier: application.id,
        operationId: 'gmail:message-123:application-1:technical:update',
        request: {
          applicationStatus: 'technical_screen',
          appliedAt: '2026-07-08T09:30:00.000Z',
          expectedVersion: 2,
        },
        type: 'update',
      },
    ])
    expect(result).toEqual({
      application: afterUpdate,
      applicationUpdated: true,
      note,
      noteReplayed: false,
      operationId: 'gmail:message-123:application-1:technical',
      requiresReview: false,
      updateOperationId: 'gmail:message-123:application-1:technical:update',
    })
  })

  test('uses correspondence time as appliedAt for a confirmed submission', async () => {
    let observedRequest: UpdateApplicationRequest | undefined
    let showCount = 0
    const afterNote = { ...application, version: 2 }
    const service = gateway({
      show: () => Effect.succeed(showCount++ === 0 ? application : afterNote),
      update: (_identifier, _operationId, request) => {
        observedRequest = request
        return Effect.succeed({
          annualCompensation: null,
          application: {
            ...afterNote,
            applicationStatus: 'applied',
            appliedAt: '2026-07-09T12:00:00.000Z',
            version: 3,
          },
          labels: [],
        })
      },
    })

    await Effect.runPromise(
      handlers(service).pipe(
        Effect.flatMap((value) =>
          value.record_application_correspondence({
            classification: 'submission_confirmed',
            evidenceSummary: 'Submission receipt.',
            expectedVersion: 1,
            gmailMessageId: 'message-submitted',
            gmailThreadId: 'thread-submitted',
            identifier: application.id,
            occurredAt: '2026-07-09T12:00:00.000Z',
            operationId: 'gmail:message-submitted:application-1:submitted',
          })
        )
      )
    )

    expect(observedRequest).toEqual({
      applicationStatus: 'applied',
      appliedAt: '2026-07-09T12:00:00.000Z',
      expectedVersion: 2,
    })
  })

  test('requires appliedAt before recording a later-stage message', async () => {
    let noteCalled = false
    const service = gateway({
      addNote: () => {
        noteCalled = true
        return Effect.succeed({ note, replayed: false })
      },
    })

    const exit = await Effect.runPromiseExit(
      handlers(service).pipe(
        Effect.flatMap((value) =>
          value.record_application_correspondence({
            classification: 'recruiter_interview_scheduled',
            evidenceSummary: 'Recruiter interview invitation.',
            expectedVersion: 1,
            gmailMessageId: 'message-recruiter',
            gmailThreadId: 'thread-recruiter',
            identifier: application.id,
            occurredAt: '2026-07-10T01:00:00.000Z',
            operationId: 'gmail:message-recruiter:application-1:recruiter',
          })
        )
      )
    )

    expect(noteCalled).toBe(false)
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Failure') {
      expect(String(exit.cause)).toContain(
        'Supply appliedAt when advancing an application beyond submission'
      )
    }
  })

  test('rejects a stale version before writing a note', async () => {
    let noteCalled = false
    const service = gateway({
      addNote: () => {
        noteCalled = true
        return Effect.succeed({ note, replayed: false })
      },
      show: () => Effect.succeed({ ...application, version: 4 }),
    })

    const exit = await Effect.runPromiseExit(
      handlers(service).pipe(
        Effect.flatMap((value) =>
          value.record_application_correspondence({
            classification: 'contact_logged',
            evidenceSummary: 'Meaningful recruiter follow-up.',
            expectedVersion: 1,
            gmailMessageId: 'message-contact',
            gmailThreadId: 'thread-contact',
            identifier: application.id,
            occurredAt: '2026-07-10T01:00:00.000Z',
            operationId: 'gmail:message-contact:application-1:contact',
          })
        )
      )
    )

    expect(noteCalled).toBe(false)
    expect(exit._tag).toBe('Failure')
    if (exit._tag === 'Failure') {
      expect(String(exit.cause)).toContain('expected 1, found 4')
    }
  })

  test('returns a review result when a status update conflicts after the note', async () => {
    let showCount = 0
    const afterNote = { ...application, version: 2 }
    const concurrent = { ...application, company: 'Concurrent', version: 3 }
    const service = gateway({
      show: () =>
        Effect.succeed(
          showCount++ === 0
            ? application
            : showCount === 2
              ? afterNote
              : concurrent
        ),
      update: () =>
        Effect.fail(
          new ApplicationRegistryToolError({
            kind: 'conflict',
            message: 'Version conflict.',
          })
        ),
    })

    const result = await Effect.runPromise(
      handlers(service).pipe(
        Effect.flatMap((value) =>
          value.record_application_correspondence({
            classification: 'submission_confirmed',
            evidenceSummary: 'Submission receipt.',
            expectedVersion: 1,
            gmailMessageId: 'message-conflict',
            gmailThreadId: 'thread-conflict',
            identifier: application.id,
            occurredAt: '2026-07-09T12:00:00.000Z',
            operationId: 'gmail:message-conflict:application-1:submitted',
          })
        )
      )
    )

    expect(result).toEqual({
      application: concurrent,
      applicationUpdated: false,
      note,
      noteReplayed: false,
      operationId: 'gmail:message-conflict:application-1:submitted',
      requiresReview: true,
      updateOperationId: null,
    })
  })
})
