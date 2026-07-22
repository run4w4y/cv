import { describe, expect, test } from 'bun:test'
import type {
  ApplicationListItem,
  UpdateApplicationRequest,
} from '@cv/application-registry-api-contract'
import type { Application } from '@cv/application-registry-entity'
import { BunServices } from '@effect/platform-bun'
import { Context, Effect } from 'effect'
import { Tool } from 'effect/unstable/ai'

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

const gateway = (
  overrides: Partial<ApplicationRegistryGatewayService> = {}
): ApplicationRegistryGatewayService => ({
  create: (request) =>
    Effect.succeed({
      ...application,
      company: request.company,
      location: request.location,
      postingUrl: request.postingUrl,
      role: request.role,
    }),
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
      'create_application',
      'update_application',
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
})
