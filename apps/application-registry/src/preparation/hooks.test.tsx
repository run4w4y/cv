import { afterEach, describe, expect, test } from 'bun:test'
import type { Application } from '@cv/application-registry-entity'
import { cleanup, renderHook, waitFor } from '@testing-library/react'

import { usePreparationBootstrap } from './hooks'

const originalFetch = globalThis.fetch

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
})

const application: Application = {
  applicationStatus: 'not_started',
  appliedAt: null,
  canonicalUrl: 'https://example.test/jobs/one',
  company: 'Example',
  createdAt: '2026-07-16T09:00:00.000Z',
  followUpAt: null,
  id: 'application-1',
  jobKey: 'web:one',
  lastContactAt: null,
  listingAvailability: 'open',
  listingCheckedAt: null,
  listingClosedCandidateAt: null,
  listingConfidence: null,
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  location: null,
  personalPriority: null,
  role: 'Staff Engineer',
  source: 'web',
  sourceJobId: 'one',
  targetStage: 'apply_next',
  updatedAt: '2026-07-16T09:00:00.000Z',
  updatedRevision: 1,
  version: 2,
}

const requestFrom = (input: RequestInfo | URL, init?: RequestInit) =>
  input instanceof Request
    ? input
    : new Request(new URL(String(input), 'http://localhost'), init)

describe('preparation bootstrap ordering', () => {
  test('does not capture or create content when the lifecycle transition fails', async () => {
    const requests: Request[] = []
    const fakeFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const request = requestFrom(input, init)
      requests.push(request.clone())
      return request.method === 'GET'
        ? Response.json(application)
        : Response.json(
            { code: 'internal_error', message: 'Transition failed.' },
            { status: 500 }
          )
    }
    globalThis.fetch = Object.assign(fakeFetch, {
      preconnect: () => undefined,
    })

    const hook = renderHook(() =>
      usePreparationBootstrap(application.id, 'en', 'cv')
    )

    await waitFor(() => expect(hook.result.current.status).toBe('error'))
    expect(
      requests.map((request) => [request.method, new URL(request.url).pathname])
    ).toEqual([
      ['GET', `/api/registry/v1/applications/${application.id}`],
      ['PATCH', `/api/registry/v1/applications/${application.id}`],
    ])
  })

  test('settles optimistic conflicts before requesting preparation data', async () => {
    const requests: Request[] = []
    let applicationReads = 0
    let patchAttempts = 0
    const applicationPath = `/api/registry/v1/applications/${application.id}`
    const fakeFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const request = requestFrom(input, init)
      requests.push(request.clone())
      const path = new URL(request.url).pathname
      if (path === applicationPath && request.method === 'GET') {
        applicationReads += 1
        return Response.json({
          ...application,
          updatedRevision: applicationReads,
          version: application.version + applicationReads - 1,
        })
      }
      if (path === applicationPath && request.method === 'PATCH') {
        patchAttempts += 1
        return patchAttempts === 1
          ? Response.json(
              {
                code: 'conflict',
                message: 'The application was updated elsewhere.',
              },
              { status: 409 }
            )
          : Response.json({
              ...application,
              applicationStatus: 'preparing',
              updatedRevision: 4,
              version: 4,
            })
      }
      return Response.json(
        { code: 'unavailable', message: 'Stop after ordering is observable.' },
        { status: 503 }
      )
    }
    globalThis.fetch = Object.assign(fakeFetch, {
      preconnect: () => undefined,
    })

    renderHook(() => usePreparationBootstrap(application.id, 'en', 'cv'))

    await waitFor(() =>
      expect(
        requests.some(
          (request) => new URL(request.url).pathname !== applicationPath
        )
      ).toBe(true)
    )

    expect(
      requests
        .slice(0, 4)
        .map((request) => [request.method, new URL(request.url).pathname])
    ).toEqual([
      ['GET', applicationPath],
      ['PATCH', applicationPath],
      ['GET', applicationPath],
      ['PATCH', applicationPath],
    ])
    expect(
      requests
        .slice(4)
        .every((request) => new URL(request.url).pathname !== applicationPath)
    ).toBe(true)
  })
})
