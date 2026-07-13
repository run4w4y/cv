import { describe, expect, test } from 'bun:test'
import type { ListingObservation } from '@cv/application-registry-entity'

import { application } from '../../test/support/fixtures'
import { decideListingCheck } from './listing-check-policy'

const checkedAt = '2026-07-13T12:00:00.000Z'

const observation = (
  input: Partial<ListingObservation> = {}
): ListingObservation => ({
  checkedAt,
  checkerVersion: '1',
  confidence: 'high',
  contentHash: null,
  evidence: [],
  finalUrl: application.canonicalUrl,
  httpStatus: 404,
  outcome: 'closed',
  provider: 'example.test',
  reasonCode: 'http_404',
  requestedUrl: application.canonicalUrl,
  ...input,
})

describe('listing check policy', () => {
  test('requires a 24-hour confirmation window for a 404', () => {
    const decision = decideListingCheck(
      { ...application, applicationStatus: 'not_started' },
      observation(),
      'archive_eligible'
    )

    expect(decision).toMatchObject({
      action: 'recheck',
      archiveApplication: false,
      availability: 'suspected_closed',
      closedCandidateAt: checkedAt,
      consecutiveClosedChecks: 1,
      nextCheckAt: '2026-07-14T12:00:00.000Z',
    })
  })

  test('archives an eligible application after the 404 grace window', () => {
    const decision = decideListingCheck(
      {
        ...application,
        applicationStatus: 'not_started',
        listingAvailability: 'suspected_closed',
        listingClosedCandidateAt: '2026-07-12T12:00:00.000Z',
        listingConsecutiveClosedChecks: 1,
      },
      observation(),
      'archive_eligible'
    )

    expect(decision).toMatchObject({
      action: 'archive',
      archiveApplication: true,
      availability: 'closed',
      consecutiveClosedChecks: 2,
    })
  })

  test('report mode never changes the application lifecycle', () => {
    const decision = decideListingCheck(
      { ...application, applicationStatus: 'not_started' },
      observation({ reasonCode: 'http_410' }),
      'report'
    )

    expect(decision.availability).toBe('closed')
    expect(decision.action).toBe('archive')
    expect(decision.archiveApplication).toBe(false)
  })

  test('a provider-confirmed closure can archive immediately', () => {
    const decision = decideListingCheck(
      { ...application, applicationStatus: 'preparing' },
      observation({ reasonCode: 'provider_closed' }),
      'archive_eligible'
    )

    expect(decision).toMatchObject({
      action: 'archive',
      archiveApplication: true,
      availability: 'closed',
    })
  })

  test('never archives an application that has already been submitted', () => {
    const decision = decideListingCheck(
      { ...application, applicationStatus: 'applied' },
      observation({ reasonCode: 'http_410' }),
      'archive_eligible'
    )

    expect(decision).toMatchObject({
      action: 'review',
      archiveApplication: false,
      availability: 'closed',
    })
  })

  test('an open signal clears a previous closure candidate', () => {
    const decision = decideListingCheck(
      {
        ...application,
        listingAvailability: 'suspected_closed',
        listingClosedCandidateAt: '2026-07-12T12:00:00.000Z',
        listingConsecutiveClosedChecks: 1,
      },
      observation({ outcome: 'open', reasonCode: 'provider_open' }),
      'archive_eligible'
    )

    expect(decision).toMatchObject({
      action: 'keep',
      archiveApplication: false,
      availability: 'open',
      closedCandidateAt: null,
      consecutiveClosedChecks: 0,
    })
  })
})
