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
    expect(paths).toContain('/machine/api/registry/facts/releases/{releaseId}')
    expect(paths).toContain('/machine/api/registry/facts/current')
    expect(paths).not.toContain('/v1/applications')
    expect(paths.some((path) => path.includes('/events'))).toBeFalse()
  })
})
