import { describe, expect, test } from 'bun:test'
import { ListingChecksService } from '@cv/application-registry-service'
import { Effect, Layer } from 'effect'
import {
  runScheduledListingChecksEffect,
  scheduledListingCheckInput,
} from './listing-checks'

describe('scheduled listing checks', () => {
  test('maps report-only configuration to a run input', () => {
    expect(
      scheduledListingCheckInput({
        archiveEnabled: false,
        batchSize: 5,
        enabled: true,
      })
    ).toEqual({
      limit: 5,
      mode: 'report',
    })
  })

  test('maps explicit archival configuration to an eligible run input', () => {
    expect(
      scheduledListingCheckInput({
        archiveEnabled: true,
        batchSize: 10,
        enabled: true,
      })
    ).toEqual({
      limit: 10,
      mode: 'archive_eligible',
    })
  })

  test('does not acquire or call the registry service when disabled', async () => {
    const result = await Effect.runPromise(
      runScheduledListingChecksEffect({
        archiveEnabled: false,
        batchSize: 5,
        enabled: false,
      }).pipe(Effect.provide(Layer.mock(ListingChecksService, {})))
    )

    expect(result).toBeUndefined()
  })
})
