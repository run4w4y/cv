import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { Application } from '@cv/application-registry-entity'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'

import { JobContextEditor } from './job-context-editor'

const originalFetch = globalThis.fetch

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
})

const application: Application = {
  applicationStatus: 'preparing',
  appliedAt: null,
  postingUrl: 'https://example.test/jobs/platform',
  company: 'Example',
  createdAt: '2026-07-16T09:00:00.000Z',
  followUpAt: null,
  id: 'application-1',
  listingAvailability: 'open',
  listingCheckedAt: null,
  listingClosedCandidateAt: null,
  listingConfidence: null,
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  location: null,
  personalPriority: null,
  role: 'Platform Engineer',
  targetStage: 'apply_next',
  updatedAt: '2026-07-16T09:00:00.000Z',
  updatedRevision: 1,
  version: 2,
}

const capturedSnapshot = {
  applicationId: application.id,
  errorCode: null,
  errorMessage: null,
  fetchedAt: '2026-07-16T10:00:00.000Z',
  fetcherVersion: 'application-registry-job-posting-fetch/v2',
  finalUrl: application.postingUrl,
  id: 'job-snapshot-captured',
  normalizedByteLength: 80,
  normalizedMediaType: 'text/plain; charset=utf-8',
  normalizedObjectKey: 'opaque/sha256/captured-normalized',
  normalizedSha256: 'captured-normalized',
  rawByteLength: 120,
  rawMediaType: 'text/html; charset=utf-8',
  rawObjectKey: 'opaque/sha256/captured-raw',
  rawSha256: 'captured-raw',
  requestedUrl: application.postingUrl,
  status: 'fetched',
}

describe('JobContextEditor', () => {
  test('lets the owner correct the context and saves a new normalized snapshot', async () => {
    const requests: Request[] = []
    globalThis.fetch = mock(async (input: string | URL | Request, init) => {
      const request = new Request(String(input), init)
      requests.push(request.clone())
      const path = new URL(request.url).pathname
      if (request.method === 'PUT') {
        const sha256 = path.split('/').at(-1) ?? ''
        return Response.json({
          byteLength: (await request.arrayBuffer()).byteLength,
          sha256,
        })
      }
      if (request.method === 'POST' && path.endsWith('/job-snapshots')) {
        return Response.json({
          ...capturedSnapshot,
          fetcherVersion: 'application-registry-management-job-context/v1',
          id: 'job-snapshot-corrected',
          rawByteLength: null,
          rawMediaType: null,
          rawObjectKey: null,
          rawSha256: null,
          status: 'provided',
        })
      }
      return path.endsWith('/job-snapshots/latest')
        ? Response.json(capturedSnapshot)
        : Response.json(application)
    }) as unknown as typeof fetch
    const view = render(
      <JobContextEditor
        applicationId={application.id}
        initialContext="Captured role context"
      />
    )

    const corrected = `Role: Platform Engineer

Requirements:
- TypeScript
- Distributed systems`
    fireEvent.change(
      view.getByRole('textbox', { name: 'Normalized job context' }),
      { target: { value: corrected } }
    )
    fireEvent.click(
      view.getByRole('button', { name: 'Save corrected context' })
    )

    await waitFor(() => {
      expect(requests.some((request) => request.method === 'PUT')).toBe(true)
      expect(requests.some((request) => request.method === 'POST')).toBe(true)
    })
    const uploaded = requests.find((request) => request.method === 'PUT')
    if (uploaded === undefined) {
      throw new Error('Expected a raw blob upload request.')
    }
    expect(await uploaded.text()).toBe(corrected)
    expect(uploaded.headers.get('content-type')).toBe(
      'application/octet-stream'
    )
    const persisted = requests.find((request) => request.method === 'POST')
    if (persisted === undefined) {
      throw new Error('Expected a snapshot persistence request.')
    }
    const body: unknown = await persisted.json()
    expect(body).toMatchObject({
      status: 'provided',
      normalized: { mediaType: 'text/plain; charset=utf-8' },
    })
    if (
      typeof body !== 'object' ||
      body === null ||
      !('normalized' in body) ||
      typeof body.normalized !== 'object' ||
      body.normalized === null ||
      !('sha256' in body.normalized) ||
      typeof body.normalized.sha256 !== 'string'
    ) {
      throw new Error('Expected a normalized job context blob reference.')
    }
    expect(new URL(uploaded.url).pathname).toEndWith(
      `/blobs/${body.normalized.sha256}`
    )
    expect('raw' in body).toBe(false)
  })
})
