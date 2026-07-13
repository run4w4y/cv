import type {
  ListingCheckTarget,
  ListingObservation,
} from '@cv/application-registry-entity'
import { DateTime, Effect, Layer } from 'effect'

import { classifyDocument, classifyHttpStatus } from './classify'
import { readListingDocument } from './document'
import { fetchListingPage, hashListingContent, type ListingFetch } from './http'
import { ListingAvailabilityChecker } from './model'
import { networkErrorObservation } from './observation'
import { checkProviderApi } from './providers'

export type { ListingFetch } from './http'

const checkTimeout = '15 seconds'

const hostname = (url: string) =>
  URL.canParse(url) ? new URL(url).hostname : 'unknown'

const checkGenericPage = (
  target: ListingCheckTarget,
  fetcher: ListingFetch,
  checkedAt: string,
  now: number
) =>
  Effect.gen(function* () {
    const result = yield* fetchListingPage(target.url, fetcher)
    const provider = hostname(result.finalUrl)
    const statusObservation = classifyHttpStatus(
      target,
      result,
      provider,
      checkedAt
    )
    if (statusObservation) return statusObservation

    return classifyDocument(
      target,
      result,
      readListingDocument(result.body),
      yield* hashListingContent(result.body),
      provider,
      checkedAt,
      now
    )
  })

const makeCheck = (fetcher: ListingFetch) => (target: ListingCheckTarget) =>
  Effect.gen(function* () {
    const now = yield* DateTime.now
    const checkedAt = DateTime.formatIso(now)
    const provider = yield* checkProviderApi(target, fetcher, checkedAt).pipe(
      Effect.catch(() => Effect.succeed(null))
    )
    return (
      provider ??
      (yield* checkGenericPage(
        target,
        fetcher,
        checkedAt,
        DateTime.toEpochMillis(now)
      ))
    )
  }).pipe(
    Effect.timeout(checkTimeout),
    Effect.catch((cause) =>
      DateTime.now.pipe(
        Effect.map(
          (now): ListingObservation =>
            networkErrorObservation(target, DateTime.formatIso(now), cause)
        )
      )
    )
  )

export const makeListingAvailabilityChecker = (
  fetcher: ListingFetch = globalThis.fetch
) => ({ check: makeCheck(fetcher) })

export const ListingAvailabilityCheckerLive = Layer.succeed(
  ListingAvailabilityChecker,
  makeListingAvailabilityChecker()
)
