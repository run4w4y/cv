import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'

import {
  BinaryBodySchema,
  CreateApplicationRequestSchema,
  decodeListActivitiesSearchParams,
  decodeListApplicationsSearchParams,
  IdempotencyHeadersSchema,
  UpdateApplicationRequestSchema,
} from './index'
import { applicationRegistryOpenApi } from './openapi'

describe('application registry API contract', () => {
  test('derives application and activity queries from drizzle-query', () => {
    const applications = decodeListApplicationsSearchParams(
      new URLSearchParams({
        filters: JSON.stringify([
          {
            type: 'condition',
            field: 'applicationStatus',
            operator: 'in',
            value: ['applied', 'technical_screen'],
          },
        ]),
        orderBy: JSON.stringify([
          { field: 'updatedRevision', direction: 'desc' },
        ]),
        size: '50',
      })
    )
    const activities = decodeListActivitiesSearchParams(
      new URLSearchParams({
        filters: JSON.stringify([
          {
            type: 'condition',
            field: 'kind',
            operator: 'in',
            value: ['status_changed', 'note_added'],
          },
        ]),
      })
    )

    expect(applications.filters).toHaveLength(1)
    expect(applications.orderBy).toEqual([
      { field: 'updatedRevision', direction: 'desc' },
    ])
    expect(activities.filters).toHaveLength(1)
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
  })

  test('publishes one unversioned registry surface', () => {
    const paths = Object.keys(applicationRegistryOpenApi.paths)
    expect(paths).toContain('/api/registry/applications')
    expect(paths).toContain('/api/registry/activities')
    expect(paths).toContain('/api/registry/blobs/{sha256}')
    expect(paths).not.toContain('/v1/applications')
    expect(paths.some((path) => path.includes('/events'))).toBeFalse()
  })
})
