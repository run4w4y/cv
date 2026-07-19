import type {
  ListingCheckTarget,
  ListingObservation,
} from '@cv/application-registry-entity'
import { Crypto, DateTime, Effect, Layer } from 'effect'

import { classifyDocument, classifyHttpStatus } from './classify'
import { readListingDocument } from './document'
import { fetchListingPage, hashListingContent, type ListingFetch } from './http'
import { ListingAvailabilityChecker } from './model'
import { networkErrorObservation } from './observation'
import { checkProviderApi } from './providers'
import { parseUrl } from './url'

export type { ListingFetch } from './http'

const checkTimeout = '15 seconds'

const hostname = (value: string) => parseUrl(value)?.hostname ?? 'unknown'

const checkGenericPage = (
  target: ListingCheckTarget,
  fetcher: ListingFetch,
  crypto: Crypto.Crypto,
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
      yield* hashListingContent(crypto, result.body),
      provider,
      checkedAt,
      now
    )
  })

const makeCheck =
  (fetcher: ListingFetch, crypto: Crypto.Crypto) =>
  (target: ListingCheckTarget) =>
    Effect.gen(function* () {
      const now = yield* DateTime.now
      const checkedAt = DateTime.formatIso(now)
      const provider = yield* checkProviderApi(
        target,
        fetcher,
        crypto,
        checkedAt
      ).pipe(Effect.catch(() => Effect.succeed(null)))
      return (
        provider ??
        (yield* checkGenericPage(
          target,
          fetcher,
          crypto,
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
  fetcher: ListingFetch,
  crypto: Crypto.Crypto
) => ({ check: makeCheck(fetcher, crypto) })

export const ListingAvailabilityCheckerLive = Layer.effect(
  ListingAvailabilityChecker,
  Crypto.Crypto.pipe(
    Effect.map((crypto) =>
      makeListingAvailabilityChecker(globalThis.fetch, crypto)
    )
  )
)
