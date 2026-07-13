import type {
  ListingCheckTarget,
  ListingObservation,
} from '@cv/application-registry-entity'

import type { ListingFetchResult } from './http'

export const checkerVersion = '1'

export const baseObservation = (
  target: ListingCheckTarget,
  result: ListingFetchResult,
  provider: string,
  checkedAt: string
) => ({
  checkedAt,
  checkerVersion,
  contentHash: null,
  evidence: [],
  finalUrl: result.finalUrl,
  httpStatus: result.status,
  provider,
  requestedUrl: target.url,
})

export const networkErrorObservation = (
  target: ListingCheckTarget,
  checkedAt: string,
  cause: unknown
): ListingObservation => ({
  checkedAt,
  checkerVersion,
  confidence: 'low',
  contentHash: null,
  evidence: [
    {
      code: 'network_error',
      detail: cause instanceof Error ? cause.message : String(cause),
      sourceUrl: target.url,
    },
  ],
  finalUrl: null,
  httpStatus: null,
  outcome: 'unknown',
  provider: 'unknown',
  reasonCode: 'network_error',
  requestedUrl: target.url,
})
