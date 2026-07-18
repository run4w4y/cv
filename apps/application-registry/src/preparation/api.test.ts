import { afterEach, describe, expect, test } from 'bun:test'
import type { Application } from '@cv/application-registry-entity'

import {
  manualJobContextFetcherVersion,
  persistManualJobContext,
  readCurrentPdf,
  readOrCaptureLatestJobSnapshot,
  startApplicationPreparation,
} from './api'
import { decodeUtf8Base64 } from './base64'

const originalFetch = globalThis.fetch

afterEach(() => {
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

const jobSnapshot = {
  applicationId: application.id,
  errorCode: null,
  errorMessage: null,
  fetchedAt: '2026-07-16T10:00:00.000Z',
  fetcherVersion: 'application-registry-job-posting-fetch/v2',
  finalUrl: application.canonicalUrl,
  id: 'job-snapshot-1',
  normalizedByteLength: null,
  normalizedMediaType: null,
  normalizedObjectKey: null,
  normalizedSha256: null,
  rawByteLength: 42,
  rawMediaType: 'text/html; charset=utf-8',
  rawObjectKey: 'opaque/sha256/example',
  rawSha256: 'example',
  requestedUrl: application.canonicalUrl,
  status: 'fetched',
}

describe('starting preparation', () => {
  test('moves a not-started application to preparing with optimistic concurrency', async () => {
    const requests: Request[] = []
    const fakeFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const request =
        input instanceof Request
          ? input
          : new Request(new URL(String(input), 'http://localhost'), init)
      requests.push(request.clone())
      return request.method === 'PATCH'
        ? Response.json({
            ...application,
            applicationStatus: 'preparing',
            updatedRevision: 2,
            version: 3,
          })
        : Response.json(application)
    }
    globalThis.fetch = Object.assign(fakeFetch, {
      preconnect: () => undefined,
    })

    const result = await startApplicationPreparation(application.id)

    expect(result.applicationStatus).toBe('preparing')
    expect(requests.map((request) => request.method)).toEqual(['GET', 'PATCH'])
    expect(await requests[1]?.json()).toEqual({
      applicationStatus: 'preparing',
      expectedVersion: 2,
    })
  })

  test('does not rewrite an application whose work already started', async () => {
    const requests: Request[] = []
    const fakeFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const request =
        input instanceof Request
          ? input
          : new Request(new URL(String(input), 'http://localhost'), init)
      requests.push(request.clone())
      return Response.json({ ...application, applicationStatus: 'preparing' })
    }
    globalThis.fetch = Object.assign(fakeFetch, {
      preconnect: () => undefined,
    })

    await startApplicationPreparation(application.id)

    expect(requests.map((request) => request.method)).toEqual(['GET'])
  })

  test('retries an optimistic conflict with the latest application version', async () => {
    const requests: Request[] = []
    let applicationReads = 0
    let patchAttempts = 0
    const fakeFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const request =
        input instanceof Request
          ? input
          : new Request(new URL(String(input), 'http://localhost'), init)
      requests.push(request.clone())
      if (request.method === 'GET') {
        applicationReads += 1
        return Response.json({
          ...application,
          updatedRevision: applicationReads,
          version: application.version + applicationReads - 1,
        })
      }

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
    globalThis.fetch = Object.assign(fakeFetch, {
      preconnect: () => undefined,
    })

    const result = await startApplicationPreparation(application.id)

    expect(result.applicationStatus).toBe('preparing')
    expect(requests.map((request) => request.method)).toEqual([
      'GET',
      'PATCH',
      'GET',
      'PATCH',
    ])
    const patchBodies = await Promise.all(
      requests
        .filter((request) => request.method === 'PATCH')
        .map((request) => request.json())
    )
    expect(patchBodies).toEqual([
      { applicationStatus: 'preparing', expectedVersion: 2 },
      { applicationStatus: 'preparing', expectedVersion: 3 },
    ])
  })

  test('bounds repeated optimistic conflicts while the application remains not started', async () => {
    const requests: Request[] = []
    let applicationReads = 0
    const fakeFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const request =
        input instanceof Request
          ? input
          : new Request(new URL(String(input), 'http://localhost'), init)
      requests.push(request.clone())
      if (request.method === 'GET') {
        applicationReads += 1
        return Response.json({
          ...application,
          updatedRevision: applicationReads,
          version: application.version + applicationReads - 1,
        })
      }
      return Response.json(
        {
          code: 'conflict',
          message: 'The application was updated elsewhere.',
        },
        { status: 409 }
      )
    }
    globalThis.fetch = Object.assign(fakeFetch, {
      preconnect: () => undefined,
    })

    await expect(startApplicationPreparation(application.id)).rejects.toThrow(
      'The application was updated elsewhere.'
    )

    expect(requests.map((request) => request.method)).toEqual([
      'GET',
      'PATCH',
      'GET',
      'PATCH',
      'GET',
      'PATCH',
      'GET',
    ])
    const patchBodies = await Promise.all(
      requests
        .filter((request) => request.method === 'PATCH')
        .map((request) => request.json())
    )
    expect(patchBodies).toEqual([
      { applicationStatus: 'preparing', expectedVersion: 2 },
      { applicationStatus: 'preparing', expectedVersion: 3 },
      { applicationStatus: 'preparing', expectedVersion: 4 },
    ])
  })
})

describe('preserved PDF reads', () => {
  test('falls back to the latest exact-publication artifact after a renderer upgrade', async () => {
    const requests: Request[] = []
    const artifact = {
      byteLength: 8,
      contentRevisionId: 'revision-1',
      createdAt: '2026-07-17T10:00:00.000Z',
      cvLinkId: 'link-1',
      errorCode: null,
      errorMessage: null,
      generatedAt: '2026-07-17T10:01:00.000Z',
      id: 'artifact-1',
      kind: 'pdf',
      mediaType: 'application/pdf',
      objectKey: 'sha256/pdf',
      publicationVersion: 1,
      qrTarget: 'https://cv.example.test/c/token',
      rendererVersion: 'renderer-v1',
      sha256: 'a'.repeat(64),
      status: 'ready',
      updatedAt: '2026-07-17T10:01:00.000Z',
      workflowId: 'workflow-1',
    }
    const fakeFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const request =
        input instanceof Request
          ? input
          : new Request(new URL(String(input), 'http://localhost'), init)
      requests.push(request.clone())
      return new URL(request.url).searchParams.has('rendererVersion')
        ? new Response(null, { status: 404 })
        : Response.json({
            artifact,
            payload: { data: 'JVBERg==', mediaType: 'application/pdf' },
          })
    }
    globalThis.fetch = Object.assign(fakeFetch, {
      preconnect: () => undefined,
    })

    const result = await readCurrentPdf(
      application.id,
      'entry-1',
      'renderer-v2'
    )

    expect(result.artifact.rendererVersion).toBe('renderer-v1')
    expect(
      requests.map((request) => {
        const url = new URL(request.url)
        return `${url.pathname}${url.search}`
      })
    ).toEqual([
      `/api/registry/v1/applications/${application.id}/content-entries/entry-1/pdf-artifacts/current/content?rendererVersion=renderer-v2`,
      `/api/registry/v1/applications/${application.id}/content-entries/entry-1/pdf-artifacts/current/content`,
    ])
  })
})

describe('job snapshot bootstrap', () => {
  test('captures the canonical posting when no snapshot exists yet', async () => {
    const requests: Request[] = []
    const fakeFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const request =
        input instanceof Request
          ? input
          : new Request(new URL(String(input), 'http://localhost'), init)
      requests.push(request.clone())
      return request.method === 'POST'
        ? Response.json(jobSnapshot)
        : Response.json(
            { code: 'not_found', message: 'No snapshot exists.' },
            { status: 404 }
          )
    }
    globalThis.fetch = Object.assign(fakeFetch, {
      preconnect: () => undefined,
    })

    const result = await readOrCaptureLatestJobSnapshot(application.id)

    expect(result.id).toBe(jobSnapshot.id)
    expect(requests.map((request) => request.method)).toEqual(['GET', 'POST'])
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      `/api/registry/v1/applications/${application.id}/job-snapshots/latest`,
      `/api/registry/v1/applications/${application.id}/job-snapshots/capture`,
    ])
  })

  test('reuses the latest immutable snapshot when one already exists', async () => {
    const requests: Request[] = []
    const fakeFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const request =
        input instanceof Request
          ? input
          : new Request(new URL(String(input), 'http://localhost'), init)
      requests.push(request.clone())
      return Response.json(jobSnapshot)
    }
    globalThis.fetch = Object.assign(fakeFetch, {
      preconnect: () => undefined,
    })

    await readOrCaptureLatestJobSnapshot(application.id)

    expect(requests.map((request) => request.method)).toEqual(['GET'])
  })

  test('persists pasted role context as a new normalized snapshot while retaining the raw capture', async () => {
    const requests: Request[] = []
    const manualSnapshot = {
      ...jobSnapshot,
      fetcherVersion: manualJobContextFetcherVersion,
      id: 'job-snapshot-manual',
      normalizedByteLength: 67,
      normalizedMediaType: 'text/plain; charset=utf-8',
      normalizedObjectKey: 'opaque/sha256/manual',
      normalizedSha256: 'manual',
      rawByteLength: null,
      rawMediaType: null,
      rawObjectKey: null,
      rawSha256: null,
      status: 'provided',
    }
    const fakeFetch = async (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> => {
      const request =
        input instanceof Request
          ? input
          : new Request(new URL(String(input), 'http://localhost'), init)
      requests.push(request.clone())
      if (request.method === 'POST') return Response.json(manualSnapshot)
      if (new URL(request.url).pathname.endsWith('/job-snapshots/latest')) {
        return Response.json(jobSnapshot)
      }
      return Response.json(application)
    }
    globalThis.fetch = Object.assign(fakeFetch, {
      preconnect: () => undefined,
    })

    const context = `Role: Staff Platform Engineer

Requirements:
- TypeScript
- Distributed systems`
    const result = await persistManualJobContext(application.id, context)

    expect(result.id).toBe(manualSnapshot.id)
    expect(requests.map((request) => request.method)).toEqual([
      'GET',
      'GET',
      'POST',
    ])
    const persistedRequest = requests[2]
    if (persistedRequest === undefined) {
      throw new Error('Expected a snapshot persistence request.')
    }
    const body: unknown = await persistedRequest.json()
    expect(body).toMatchObject({
      fetcherVersion: manualJobContextFetcherVersion,
      finalUrl: application.canonicalUrl,
      requestedUrl: application.canonicalUrl,
      status: 'provided',
      normalized: { mediaType: 'text/plain; charset=utf-8' },
    })
    if (
      typeof body !== 'object' ||
      body === null ||
      !('normalized' in body) ||
      typeof body.normalized !== 'object' ||
      body.normalized === null ||
      !('data' in body.normalized) ||
      typeof body.normalized.data !== 'string'
    ) {
      throw new Error('Expected a normalized snapshot payload.')
    }
    expect(decodeUtf8Base64(body.normalized.data)).toBe(context)
    expect('raw' in body).toBe(false)
  })
})
