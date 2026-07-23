import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'

import {
  BinaryBodySchema,
  CreateApplicationRequestSchema,
  decodeListActivitiesSearchParams,
  decodeListApplicationsSearchParams,
  encodeListApplicationsSearchParams,
  FactsReleaseBundleBodySchema,
  IdempotencyHeadersSchema,
  PersistJobPostingSnapshotRequestSchema,
  UpdateApplicationRequestSchema,
} from './index'
import { applicationRegistryOpenApi } from './openapi'

describe('application registry API contract', () => {
  test('derives application and activity queries from drizzle-query', () => {
    const applications = decodeListApplicationsSearchParams(
      new URLSearchParams({
        filter: 'applicationStatus:in:[applied,technical_screen]',
        sort: 'updatedRevision:desc',
        size: '50',
      })
    )
    const activities = decodeListActivitiesSearchParams(
      new URLSearchParams({
        filter: 'kind:in:[status_changed,note_added]',
      })
    )

    expect(applications.filters).toHaveLength(1)
    expect(applications.orderBy).toEqual([
      { field: 'updatedRevision', direction: 'desc' },
    ])
    expect(activities.filters).toHaveLength(1)
    const encoded = encodeListApplicationsSearchParams(applications)
    expect(encoded.get('filter')).toBe(
      'applicationStatus:in:[applied,technical_screen]'
    )
    expect(encoded.get('sort')).toBe('updatedRevision:desc')
    expect(encoded.has('filters')).toBe(false)
    expect(encoded.has('orderBy')).toBe(false)
  })

  test('ignores obsolete JSON query parameter names', () => {
    expect(
      decodeListApplicationsSearchParams('filters=whatever&orderBy=whatever')
    ).toEqual({})
  })

  test('exposes no client-managed identity or event mutation fields', () => {
    const created = Schema.decodeUnknownSync(CreateApplicationRequestSchema)({
      company: 'Example',
      location: null,
      postingUrl: 'https://example.test/jobs/one',
      role: 'Engineer',
    })
    const updated = Schema.decodeUnknownSync(UpdateApplicationRequestSchema)({
      applicationStatus: 'applied',
      expectedVersion: 1,
    })
    const headers = Schema.decodeUnknownSync(IdempotencyHeadersSchema)({
      'idempotency-key': 'request-1',
    })

    expect(created).not.toHaveProperty('jobKey')
    expect(created).not.toHaveProperty('source')
    expect(updated).not.toHaveProperty('operationId')
    expect(headers['idempotency-key']).toBe('request-1')
  })

  test('rejects inverted compensation ranges before persistence', () => {
    expect(() =>
      Schema.decodeUnknownSync(CreateApplicationRequestSchema)({
        company: 'Example',
        compensations: [
          {
            kind: 'base_salary',
            currencyCode: 'USD',
            minimumMinor: 200_000,
            maximumMinor: 150_000,
            period: 'year',
            rawText: '$200k–$150k',
            source: 'job-board',
          },
        ],
        location: null,
        postingUrl: 'https://example.test/jobs/one',
        role: 'Engineer',
      })
    ).toThrow()
  })

  test('rejects blank application identity fields at the HTTP boundary', () => {
    expect(() =>
      Schema.decodeUnknownSync(CreateApplicationRequestSchema)({
        company: '   ',
        location: null,
        postingUrl: 'https://example.test/jobs/one',
        role: 'Engineer',
      })
    ).toThrow()
    expect(() =>
      Schema.decodeUnknownSync(UpdateApplicationRequestSchema)({
        expectedVersion: 1,
        location: '   ',
      })
    ).toThrow()
  })

  test('rejects non-HTTP snapshot URLs at the HTTP boundary', () => {
    expect(() =>
      Schema.decodeUnknownSync(PersistJobPostingSnapshotRequestSchema)({
        fetcherVersion: 'fetcher-v1',
        finalUrl: null,
        requestedUrl: 'file:///tmp/job.html',
        status: 'fetched',
      })
    ).toThrow(/HTTP or HTTPS/u)
  })

  test('uses raw Uint8Array transport for blobs', () => {
    const bytes = new Uint8Array([1, 2, 3])
    expect(Schema.decodeUnknownSync(BinaryBodySchema)(bytes)).toEqual(bytes)
    expect(
      Schema.decodeUnknownSync(FactsReleaseBundleBodySchema)(bytes)
    ).toEqual(bytes)
  })

  test('publishes one unversioned registry surface', () => {
    const paths = Object.keys(applicationRegistryOpenApi.paths)
    expect(paths).toContain('/api/registry/applications')
    expect(paths).toContain('/api/registry/activities')
    expect(paths).toContain('/api/registry/blobs/{sha256}')
    expect(paths).toContain('/api/registry/health')
    expect(paths).toContain('/api/registry/facts/releases/{releaseId}')
    expect(paths).toContain('/api/registry/facts/current')
    expect(paths.some((path) => path.startsWith('/machine'))).toBeFalse()
    expect(paths).not.toContain('/v1/applications')
    expect(paths.some((path) => path.includes('/events'))).toBeFalse()
  })
})
