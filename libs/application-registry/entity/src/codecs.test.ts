import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import {
  ApplicationCompensationInputSchema,
  ApplicationEventInsertSchema,
  ApplicationMutableSchema,
  ApplicationRowSelectSchema,
  ApplicationWritableSchema,
  ContentRevisionSchema,
  CvLinkSchema,
  FitAssessmentSchema,
  FxRateInputSchema,
  normalizeApplicationCanonicalUrl,
} from './index'
import {
  appendableApplicationEventKindValues,
  informationalApplicationEventKindValues,
  statusChangingApplicationEventKindValues,
} from './model/values'

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
  followUpAt: null,
  appliedAt: null,
  lastContactAt: null,
  listingAvailability: 'unchecked',
  listingCheckedAt: null,
  listingClosedCandidateAt: null,
  listingConfidence: null,
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  version: 1,
  updatedRevision: 1,
  createdAt: '2026-07-10T00:00:00.000Z',
  updatedAt: '2026-07-10T00:00:00.000Z',
} as const

describe('application registry database schemas', () => {
  test('decodes the simplified application lifecycle row', () => {
    const row = Schema.decodeUnknownSync(ApplicationRowSelectSchema)(
      applicationRow
    )

    expect(row.company).toBe('Example')
    expect(row.applicationStatus).toBe('not_started')
    expect(row.listingAvailability).toBe('unchecked')
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
    const nullableWritable = Schema.decodeUnknownSync(
      ApplicationWritableSchema
    )({
      canonicalUrl: 'https://example.test/jobs/three',
      company: 'Example',
      followUpAt: null,
      jobKey: 'web:three',
      role: 'Engineer',
      source: 'web',
    })
    const mutable = Schema.decodeUnknownSync(ApplicationMutableSchema)({
      canonicalUrl: 'https://example.test/jobs/updated',
      company: 'Updated Example',
      followUpAt: null,
      location: null,
      role: 'Staff Engineer',
      source: 'official',
      sourceJobId: null,
    })

    expect(writable.followUpAt).toBeUndefined()
    expect(nullableWritable.followUpAt).toBeNull()
    expect(mutable.followUpAt).toBeNull()
    expect(mutable.company).toBe('Updated Example')
    expect(mutable.location).toBeNull()
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

  test('requires fit assessment dimensions to sum to the total score', () => {
    const assessment = {
      dimensions: {
        coreExperience: 20,
        hardRequirements: 30,
        practicalEligibility: 8,
        preferredSignals: 7,
        seniorityAndScope: 12,
      },
      gaps: [],
      hardBlockers: [],
      rationale: 'Evidence-based fit assessment.',
      rubricVersion: 'application-fit-v1',
      score: 77,
      strengths: [],
    }

    expect(
      Schema.decodeUnknownSync(FitAssessmentSchema)(assessment).score
    ).toBe(77)
    expect(() =>
      Schema.decodeUnknownSync(FitAssessmentSchema)({
        ...assessment,
        score: 78,
      })
    ).toThrow()
  })

  test('normalizes empty fragments and tracking parameters from identity URLs', () => {
    expect(
      normalizeApplicationCanonicalUrl(
        'https://example.test/jobs/one?utm_source=mail#'
      )
    ).toBe('https://example.test/jobs/one')
  })

  test('models document revisions as opaque versioned object descriptors', () => {
    const revision = Schema.decodeUnknownSync(ContentRevisionSchema)({
      id: 'revision-1',
      contentEntryId: 'entry-1',
      revisionNumber: 1,
      parentRevisionId: null,
      contractId: 'cv.document',
      contractVersion: 'cv.document.v1',
      objectKey: 'documents/sha256/abc.json',
      sha256: 'abc',
      byteLength: 42,
      mediaType: 'application/json',
      source: 'ai',
      factsReleaseId: 'facts-1',
      jobSnapshotId: 'job-1',
      operationId: 'operation-1',
      createdAt: '2026-07-17T00:00:00.000Z',
    })

    expect(revision.contractVersion).toBe('cv.document.v1')
    expect(revision).not.toHaveProperty('document')
    expect(() =>
      Schema.decodeUnknownSync(ContentRevisionSchema)({
        ...revision,
        byteLength: -1,
      })
    ).toThrow()
  })

  test('keeps public CV links stable and reversibly enabled', () => {
    const link = Schema.decodeUnknownSync(CvLinkSchema)({
      id: 'link-1',
      applicationId: 'application-1',
      contentEntryId: 'entry-1',
      publishedRevisionId: 'revision-1',
      token: 'public-token',
      publicUrl: 'https://cv.example.test/c/public-token',
      enabled: true,
      disabledReason: null,
      disabledAt: null,
      publicationVersion: 1,
      version: 1,
      createdAt: '2026-07-17T00:00:00.000Z',
      updatedAt: '2026-07-17T00:00:00.000Z',
    })

    expect(link.enabled).toBeTrue()
    expect(link.token).toBe('public-token')
    expect(link.publicationVersion).toBe(1)
  })
})
