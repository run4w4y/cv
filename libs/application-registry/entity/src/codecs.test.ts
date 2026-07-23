import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import {
  ApplicationActivityInsertSchema,
  ApplicationCompensationInputSchema,
  ApplicationMutableSchema,
  ApplicationRowSelectSchema,
  ApplicationWritableSchema,
  ContentRevisionSchema,
  CvLinkSchema,
  HttpUrlSchema,
  ListingObservationSchema,
  normalizeApplicationPostingUrl,
} from './index'
import { applicationActivityKindValues } from './model/values'
import { AnnualCompensationSchema } from './query'

const applicationRow = {
  id: 'application-1',
  postingUrl: 'https://example.test/jobs/one',
  postingUrlNormalized: 'https://example.test/jobs/one',
  postingFingerprint: 'abc123',
  company: 'Example',
  role: 'Engineer',
  location: 'Tokyo / Remote',
  applicationStatus: 'not_started',
  targetStage: 'apply_next',
  personalPriority: 'high',
  followUpAt: null,
  appliedAt: null,
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

  test('rejects inverted compensation ranges at the shared input boundary', () => {
    expect(() =>
      Schema.decodeUnknownSync(ApplicationCompensationInputSchema)({
        kind: 'base_salary',
        currencyCode: 'JPY',
        minimumMinor: 14_000_000,
        maximumMinor: 10_000_000,
        period: 'year',
        rawText: 'JPY 14M–10M',
        source: 'job-board',
      })
    ).toThrow()
    expect(() =>
      Schema.decodeUnknownSync(AnnualCompensationSchema)({
        currencyCode: 'JPY',
        minimumMinor: 14_000_000,
        maximumMinor: 10_000_000,
      })
    ).toThrow()
  })

  test('preserves Drizzle insert and update optionality around refinements', () => {
    const writable = Schema.decodeUnknownSync(ApplicationWritableSchema)({
      postingUrl: 'https://example.test/jobs/two',
      company: 'Example',
      role: 'Engineer',
    })
    const nullableWritable = Schema.decodeUnknownSync(
      ApplicationWritableSchema
    )({
      postingUrl: 'https://example.test/jobs/three',
      company: 'Example',
      followUpAt: null,
      role: 'Engineer',
    })
    const mutable = Schema.decodeUnknownSync(ApplicationMutableSchema)({
      postingUrl: 'https://example.test/jobs/updated',
      company: 'Updated Example',
      followUpAt: null,
      location: null,
      role: 'Staff Engineer',
    })

    expect(writable.followUpAt).toBeUndefined()
    expect(nullableWritable.followUpAt).toBeNull()
    expect(mutable.followUpAt).toBeNull()
    expect(mutable.company).toBe('Updated Example')
    expect(mutable.location).toBeNull()
  })

  test('uses canonical nonempty application identity fields', () => {
    expect(() =>
      Schema.decodeUnknownSync(ApplicationWritableSchema)({
        postingUrl: 'https://example.test/jobs/two',
        company: '   ',
        role: 'Engineer',
      })
    ).toThrow()
    expect(() =>
      Schema.decodeUnknownSync(ApplicationMutableSchema)({
        location: '   ',
      })
    ).toThrow()
  })

  test('derives backend activity insert schemas from the table', () => {
    const activity = Schema.decodeUnknownSync(ApplicationActivityInsertSchema)({
      actor: 'system',
      applicationId: applicationRow.id,
      id: 'activity-1',
      kind: 'application_created',
      occurredAt: applicationRow.createdAt,
      payload: {},
      revision: 2,
      source: 'management',
    })

    expect(activity.kind).toBe('application_created')
    expect(applicationActivityKindValues).not.toContain('submitted' as never)
  })

  test('normalizes empty fragments and tracking parameters from identity URLs', () => {
    expect(
      normalizeApplicationPostingUrl(
        'https://example.test/jobs/one?utm_source=mail#'
      )
    ).toBe('https://example.test/jobs/one')
  })

  test('uses one HTTP URL schema for application submission boundaries', () => {
    expect(
      Schema.decodeUnknownSync(HttpUrlSchema)(
        ' HTTPS://EXAMPLE.TEST/jobs/one#apply '
      )
    ).toBe('HTTPS://EXAMPLE.TEST/jobs/one#apply')
    expect(
      Schema.decodeUnknownSync(HttpUrlSchema)(
        'http://127.0.0.1/internal-listing'
      )
    ).toBe('http://127.0.0.1/internal-listing')
    expect(() =>
      Schema.decodeUnknownSync(ApplicationWritableSchema)({
        company: 'Example',
        postingUrl: 'file:///tmp/job.html',
        role: 'Engineer',
      })
    ).toThrow(/HTTP or HTTPS/u)
    expect(() =>
      Schema.decodeUnknownSync(ApplicationMutableSchema)({
        postingUrl: 'mailto:jobs@example.test',
      })
    ).toThrow(/HTTP or HTTPS/u)
    expect(() =>
      Schema.decodeUnknownSync(ListingObservationSchema)({
        checkedAt: applicationRow.updatedAt,
        checkerVersion: 'checker-v1',
        confidence: 'high',
        contentHash: null,
        evidence: [],
        finalUrl: null,
        httpStatus: null,
        outcome: 'unknown',
        provider: 'test',
        reasonCode: 'network_error',
        requestedUrl: 'file:///tmp/listing.html',
      })
    ).toThrow(/HTTP or HTTPS/u)
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
      currentRevisionId: 'revision-1',
      previewToken: 'preview-token-1',
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
    expect(() =>
      Schema.decodeUnknownSync(CvLinkSchema)({
        ...link,
        publicUrl: 'file:///tmp/public-cv.html',
      })
    ).toThrow(/HTTP or HTTPS/u)
  })
})
