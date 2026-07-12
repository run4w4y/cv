import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import {
  appendableApplicationEventKindValues,
  informationalApplicationEventKindValues,
  statusChangingApplicationEventKindValues,
} from './model/values'
import {
  ApplicationCompensationInputSchema,
  ApplicationEventInsertSchema,
  ApplicationMutableSchema,
  ApplicationRowSelectSchema,
  ApplicationWritableSchema,
  FxRateInputSchema,
} from './schema'

const applicationRow = {
  id: 'application-1',
  jobKey: 'web:one',
  source: 'web',
  sourceJobId: null,
  canonicalUrl: 'https://example.test/jobs/one',
  company: 'Example',
  companyNormalized: 'example',
  role: 'Engineer',
  location: 'Tokyo / Remote',
  applicationStatus: 'not_started',
  targetStage: 'apply_next',
  personalPriority: 'high',
  fitScore: 91,
  category: 'Backend',
  remotePolicy: 'Hybrid',
  details: {
    countryCode: 'JP',
    region: 'Tokyo',
    workMode: 'remote',
    remoteRegion: 'Japan',
    timezoneOverlap: 'JST',
    employmentType: 'Full-time',
    languageRequirements: ['Japanese: Conversational'],
    workAuthorization: null,
    residenceRequirement: 'Non-resident compatible',
    applyFromAbroad: 'Yes, verify',
    visaSponsorship: 'Available',
    relocationSupport: 'Available',
  },
  openStatus: 'Open',
  sourceConfidence: 'High',
  technologyStack: 'TypeScript, Effect',
  recommendedAction: 'Apply',
  researchPriority: 'Top target',
  followUpAt: null,
  appliedAt: null,
  lastContactAt: null,
  version: 1,
  updatedRevision: 1,
  createdAt: '2026-07-10T00:00:00.000Z',
  updatedAt: '2026-07-10T00:00:00.000Z',
} as const

describe('application registry database schemas', () => {
  test('preserves geography and remote requirements in one opportunity', () => {
    const row = Schema.decodeUnknownSync(ApplicationRowSelectSchema)(
      applicationRow
    )

    expect(row.details?.countryCode).toBe('JP')
    expect(row.details?.remoteRegion).toBe('Japan')
    expect(row.details?.visaSponsorship).toBe('Available')
  })

  test('models original compensation in minor units', () => {
    const compensation = Schema.decodeUnknownSync(
      ApplicationCompensationInputSchema
    )({
      kind: 'base_salary',
      currencyCode: 'JPY',
      minimumMinor: 10_000_000,
      maximumMinor: 14_000_000,
      period: 'year',
      rawText: 'JPY 10M–14M',
      source: 'job-board',
    })

    expect(compensation.minimumMinor).toBe(10_000_000)
    expect(compensation.currencyCode).toBe('JPY')
  })

  test('preserves Drizzle insert and update optionality around refinements', () => {
    const writable = Schema.decodeUnknownSync(ApplicationWritableSchema)({
      canonicalUrl: 'https://example.test/jobs/two',
      company: 'Example',
      jobKey: 'web:two',
      role: 'Engineer',
      source: 'web',
    })
    const mutable = Schema.decodeUnknownSync(ApplicationMutableSchema)({
      details: null,
      fitScore: null,
    })

    expect(writable.fitScore).toBeUndefined()
    expect(mutable.details).toBeNull()
  })

  test('derives event insert optionality and lifecycle classifications once', () => {
    const event = Schema.decodeUnknownSync(ApplicationEventInsertSchema)({
      applicationId: applicationRow.id,
      id: 'event-1',
      kind: 'research_updated',
      occurredAt: applicationRow.createdAt,
      operationId: 'operation-1',
      payload: {},
      recordedAt: applicationRow.createdAt,
      revision: 2,
    })

    expect(event.deviceId).toBeUndefined()
    expect(appendableApplicationEventKindValues).toEqual([
      ...statusChangingApplicationEventKindValues,
      ...informationalApplicationEventKindValues,
    ])
    expect(appendableApplicationEventKindValues).not.toContain('discovered')
  })

  test('applies domain checks that SQLite metadata cannot express', () => {
    expect(() =>
      Schema.decodeUnknownSync(ApplicationWritableSchema)({
        canonicalUrl: 'https://example.test/jobs/three',
        company: 'Example',
        fitScore: 101,
        jobKey: 'web:three',
        role: 'Engineer',
        source: 'web',
      })
    ).toThrow()

    expect(() =>
      Schema.decodeUnknownSync(FxRateInputSchema)({
        baseCurrency: 'USD',
        quoteCurrency: 'JPY',
        rate: 0,
        provider: 'fixture',
        observedAt: '2026-07-10T00:00:00.000Z',
        fetchedAt: '2026-07-10T12:00:00.000Z',
      })
    ).toThrow()
  })

  test('rejects non-ISO-shaped currency codes', () => {
    const decode = Schema.decodeUnknownSync(FxRateInputSchema)

    expect(() =>
      decode({
        baseCurrency: 'usd',
        quoteCurrency: 'JPY',
        rate: 150,
        provider: 'fixture',
        observedAt: '2026-07-10T00:00:00.000Z',
        fetchedAt: '2026-07-10T12:00:00.000Z',
      })
    ).toThrow()
  })
})
