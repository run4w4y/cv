import { describe, expect, test } from 'bun:test'
import type { D1Database } from '@cloudflare/workers-types'

import type { ApplicationRegistryEnv } from '../worker/types'
import {
  listingChecksAreEnabled,
  scheduledListingCheckInput,
} from './listing-checks'

const env = (
  values: Omit<ApplicationRegistryEnv, 'APPLICATION_REGISTRY_DB'> = {}
): ApplicationRegistryEnv => ({
  APPLICATION_REGISTRY_DB: undefined as unknown as D1Database,
  ...values,
})

describe('scheduled listing checks', () => {
  test('defaults to a small report-only batch', () => {
    expect(listingChecksAreEnabled(env())).toBe(true)
    expect(scheduledListingCheckInput(env())).toEqual({
      limit: 5,
      mode: 'report',
    })
  })

  test('requires explicit archival enablement and caps the batch size', () => {
    expect(
      scheduledListingCheckInput(
        env({
          LISTING_CHECK_ARCHIVE_ENABLED: 'true',
          LISTING_CHECK_BATCH_SIZE: '999',
        })
      )
    ).toEqual({
      limit: 10,
      mode: 'archive_eligible',
    })
  })

  test('can disable the cron without removing its trigger', () => {
    expect(
      listingChecksAreEnabled(env({ LISTING_CHECKS_ENABLED: 'false' }))
    ).toBe(false)
  })
})
