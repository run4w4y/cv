import { describe, expect, test } from 'bun:test'
import { Effect, Exit } from 'effect'

import { registryTables } from './manifest'
import { normalizeRow, tableDigest } from './transform'

const spec = (name: string) => {
  const found = registryTables.find((table) => table.name === name)
  if (found === undefined) throw new Error(`Missing table spec ${name}.`)
  return found
}

const activityRow = (overrides: Readonly<Record<string, unknown>> = {}) => ({
  id: 'activity-1',
  application_id: 'application-1',
  kind: 'application_created',
  actor: 'migration',
  source: 'migration',
  revision: 1,
  occurred_at: '2026-07-20T12:00:00.000Z',
  payload: '{}',
  ...overrides,
})

const compensationRow = (
  overrides: Readonly<Record<string, unknown>> = {}
) => ({
  id: 'compensation-1',
  application_id: 'application-1',
  kind: 'base_salary',
  currency_code: 'IDR',
  minimum_minor: 3_000_000_000,
  maximum_minor: 4_000_000_000,
  period: 'year',
  raw_text: null,
  source: 'migration',
  created_at: '2026-07-20T12:00:00.000Z',
  updated_at: '2026-07-20T12:00:00.000Z',
  ...overrides,
})

describe('D1 migration normalization', () => {
  test('preserves legacy posting fingerprints verbatim', async () => {
    const normalized = await Effect.runPromise(
      normalizeRow(
        spec('applications'),
        {
          id: 'application-2',
          posting_url: 'https://example.com/jobs',
          posting_url_normalized: 'https://example.com/jobs',
          posting_fingerprint: 'https://example.com/jobs#application-2',
          company: 'Example',
          role: 'Engineer',
          location: null,
          application_status: 'not_started',
          target_stage: 'backlog',
          personal_priority: null,
          follow_up_at: null,
          applied_at: null,
          listing_availability: 'unchecked',
          listing_confidence: null,
          listing_reason_code: null,
          listing_checked_at: null,
          listing_closed_candidate_at: null,
          listing_consecutive_closed_checks: 0,
          version: 1,
          updated_revision: 2,
          created_at: '2026-07-20T12:00:00.000Z',
          updated_at: '2026-07-20T12:00:00.000Z',
        },
        'd1'
      )
    )

    expect(normalized.posting_fingerprint).toBe(
      'https://example.com/jobs#application-2'
    )
  })

  test('converts D1 JSON, booleans, and timestamps losslessly', async () => {
    const activity = await Effect.runPromise(
      normalizeRow(
        spec('application_activities'),
        {
          id: 'activity-1',
          application_id: 'application-1',
          kind: 'application_created',
          actor: 'migration',
          source: 'migration',
          revision: 1,
          occurred_at: '2026-07-20T12:00:00.000Z',
          payload: '{"nested":{"b":2,"a":1}}',
        },
        'd1'
      )
    )
    expect(activity.occurred_at).toBe('2026-07-20T12:00:00.000Z')
    expect(activity.payload).toEqual({ nested: { a: 1, b: 2 } })

    const link = await Effect.runPromise(
      normalizeRow(
        spec('cv_links'),
        {
          id: 'link-1',
          application_id: 'application-1',
          content_entry_id: 'entry-1',
          current_revision_id: 'revision-1',
          token: 'public',
          preview_token: 'preview',
          public_url: 'https://example.com/cv/public',
          enabled: 1,
          disabled_reason: null,
          disabled_at: null,
          publication_version: 1,
          version: 1,
          created_at: '2026-07-20T12:00:00.000Z',
          updated_at: '2026-07-20T12:00:00.000Z',
        },
        'd1'
      )
    )
    expect(link.enabled).toBe(true)
  })

  test('uses canonical JSON and instants for row digests', async () => {
    const table = spec('application_activities')
    const d1 = await Effect.runPromise(
      normalizeRow(
        table,
        {
          id: 'activity-1',
          application_id: 'application-1',
          kind: 'application_created',
          actor: 'migration',
          source: 'migration',
          revision: 1,
          occurred_at: '2026-07-20T12:00:00.000Z',
          payload: '{"b":2,"a":1}',
        },
        'd1'
      )
    )
    const postgres = await Effect.runPromise(
      normalizeRow(
        table,
        {
          ...d1,
          occurred_at: new Date('2026-07-20T12:00:00.000Z'),
          payload: { a: 1, b: 2 },
        },
        'postgres'
      )
    )
    expect(tableDigest(table, [d1])).toBe(tableDigest(table, [postgres]))
  })

  test('normalizes PostgreSQL bigint amounts into safe numbers', async () => {
    const table = spec('application_compensations')
    const d1 = await Effect.runPromise(
      normalizeRow(table, compensationRow(), 'd1')
    )
    const postgres = await Effect.runPromise(
      normalizeRow(
        table,
        compensationRow({
          minimum_minor: '3000000000',
          maximum_minor: '4000000000',
        }),
        'postgres'
      )
    )

    expect(postgres.minimum_minor).toBe(3_000_000_000)
    expect(postgres.maximum_minor).toBe(4_000_000_000)
    expect(tableDigest(table, [postgres])).toBe(tableDigest(table, [d1]))

    const unsafe = await Effect.runPromiseExit(
      normalizeRow(
        table,
        compensationRow({ maximum_minor: '9007199254740992' }),
        'postgres'
      )
    )
    expect(Exit.isFailure(unsafe)).toBe(true)
  })

  test('rejects non-boolean SQLite values', async () => {
    const result = await Effect.runPromiseExit(
      normalizeRow(
        spec('cv_links'),
        {
          id: 'link-1',
          application_id: 'application-1',
          content_entry_id: 'entry-1',
          current_revision_id: 'revision-1',
          token: 'public',
          preview_token: 'preview',
          public_url: 'https://example.com/cv/public',
          enabled: 2,
          disabled_reason: null,
          disabled_at: null,
          publication_version: 1,
          version: 1,
          created_at: '2026-07-20T12:00:00.000Z',
          updated_at: '2026-07-20T12:00:00.000Z',
        },
        'd1'
      )
    )
    expect(Exit.isFailure(result)).toBe(true)
  })

  test('rejects non-canonical D1 timestamp text', async () => {
    const result = await Effect.runPromiseExit(
      normalizeRow(
        spec('application_activities'),
        activityRow({ occurred_at: '2026-07-20 12:00:00+00' }),
        'd1'
      )
    )
    expect(Exit.isFailure(result)).toBe(true)
  })

  test('rejects JSON object keys that collide after escape decoding', async () => {
    const result = await Effect.runPromiseExit(
      normalizeRow(
        spec('application_activities'),
        activityRow({ payload: '{"value":1,"\\u0076alue":2}' }),
        'd1'
      )
    )
    expect(Exit.isFailure(result)).toBe(true)
  })

  test('rejects JSON numbers that JavaScript cannot preserve', async () => {
    for (const payload of [
      '{"value":9007199254740993}',
      '{"value":0.1234567890123456789}',
      '{"value":1e400}',
    ]) {
      const result = await Effect.runPromiseExit(
        normalizeRow(
          spec('application_activities'),
          activityRow({ payload }),
          'd1'
        )
      )
      expect(Exit.isFailure(result)).toBe(true)
    }
  })

  test('accepts alternate lossless JSON number spellings', async () => {
    const result = await Effect.runPromise(
      normalizeRow(
        spec('application_activities'),
        activityRow({
          payload: '{"decimal":0.125,"scientific":1e3,"whole":1.0}',
        }),
        'd1'
      )
    )
    expect(result.payload).toEqual({
      decimal: 0.125,
      scientific: 1000,
      whole: 1,
    })
  })
})
