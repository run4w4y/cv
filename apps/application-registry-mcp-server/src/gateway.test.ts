import { describe, expect, test } from 'bun:test'
import { makeApplicationRegistryHttpClientLayer } from '@cv/application-registry-api-client'
import type {
  CreateApplicationRequest,
  UpdateApplicationResponse,
} from '@cv/application-registry-api-contract'
import type { Application } from '@cv/application-registry-entity'
import { BunServices } from '@effect/platform-bun'
import { Effect, Layer, Redacted } from 'effect'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'

import {
  ApplicationRegistryGateway,
  ApplicationRegistryGatewayLive,
} from './gateway'

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

const makeFetch = (
  respond: (request: Request) => Promise<Response>
): typeof globalThis.fetch =>
  Object.assign(
    (input: RequestInfo | URL, init?: RequestInit) =>
      respond(new Request(input, init)),
    { preconnect: globalThis.fetch.preconnect }
  )

const withGateway = <A, E>(
  fetch: typeof globalThis.fetch,
  effect: Effect.Effect<A, E, ApplicationRegistryGateway>
) => {
  const fetchLayer = FetchHttpClient.layer.pipe(
    Layer.provide(Layer.succeed(FetchHttpClient.Fetch, fetch))
  )
  const platformLayer = Layer.merge(BunServices.layer, fetchLayer)
  const clientLayer = makeApplicationRegistryHttpClientLayer({
    baseUrl: new URL('https://registry.example.test/'),
    token: Redacted.make('test-token'),
  }).pipe(Layer.provide(platformLayer))

  return effect.pipe(
    Effect.provide(
      ApplicationRegistryGatewayLive.pipe(Layer.provide(clientLayer))
    )
  )
}

describe('application registry MCP gateway', () => {
  test('uses the generated create and update routes with bearer credentials', async () => {
    const requests: Request[] = []
    const updateResponse: UpdateApplicationResponse = {
      annualCompensation: null,
      application: { ...application, company: 'Updated', version: 2 },
      labels: [],
    }
    const fetch = makeFetch(async (request) => {
      requests.push(request)
      return request.method === 'POST'
        ? Response.json(application, { status: 201 })
        : Response.json(updateResponse)
    })
    const createRequest: CreateApplicationRequest = {
      company: application.company,
      location: application.location,
      postingUrl: application.postingUrl,
      role: application.role,
    }

    const result = await Effect.runPromise(
      withGateway(
        fetch,
        Effect.gen(function* () {
          const gateway = yield* ApplicationRegistryGateway
          const created = yield* gateway.create(createRequest)
          const updated = yield* gateway.update(application.id, 'update-key', {
            company: 'Updated',
            expectedVersion: 1,
          })
          return { created, updated }
        })
      )
    )

    expect(result.created).toEqual(application)
    expect(result.updated).toEqual(updateResponse)
    expect(requests.map(({ method, url }) => ({ method, url }))).toEqual([
      {
        method: 'POST',
        url: 'https://registry.example.test/api/registry/applications',
      },
      {
        method: 'PATCH',
        url: 'https://registry.example.test/api/registry/applications/application-1',
      },
    ])
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer test-token')
    expect(requests[1]?.headers.get('idempotency-key')).toBe('update-key')
  })

  test('maps API authentication failures to a secret-safe tool error', async () => {
    const fetch = makeFetch(async () =>
      Response.json(
        { code: 'unauthorized', message: 'token test-token was rejected' },
        { status: 401 }
      )
    )

    const error = await Effect.runPromise(
      withGateway(
        fetch,
        ApplicationRegistryGateway.pipe(
          Effect.flatMap((gateway) => gateway.show(application.id)),
          Effect.flip
        )
      )
    )

    expect(error.kind).toBe('unauthorized')
    expect(error.message).toBe(
      'The application registry rejected its configured token.'
    )
    expect(error.message).not.toContain('test-token')
  })
})
