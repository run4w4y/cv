import type {
  ListingCheckTarget,
  ListingObservation,
} from '@cv/application-registry-entity'
import { Effect } from 'effect'

import { fetchListingPage, hashListingContent, type ListingFetch } from './http'
import { baseObservation } from './observation'

type ProviderApiTarget = {
  readonly provider: string
  readonly url: string
}

const providerApiTarget = (
  target: ListingCheckTarget
): ProviderApiTarget | null => {
  if (!URL.canParse(target.url)) return null

  const url = new URL(target.url)
  const segments = url.pathname.split('/').filter(Boolean)
  if (
    url.hostname === 'job-boards.greenhouse.io' &&
    segments[0] &&
    segments[1] === 'jobs' &&
    segments[2]
  ) {
    return {
      provider: 'greenhouse',
      url: `https://boards-api.greenhouse.io/v1/boards/${segments[0]}/jobs/${segments[2]}`,
    }
  }
  if (url.hostname === 'jobs.lever.co' && segments[0] && segments[1]) {
    return {
      provider: 'lever',
      url: `https://api.lever.co/v0/postings/${segments[0]}/${segments[1]}`,
    }
  }
  return null
}

export const checkProviderApi = (
  target: ListingCheckTarget,
  fetcher: ListingFetch,
  checkedAt: string
): Effect.Effect<ListingObservation | null, unknown> => {
  const api = providerApiTarget(target)
  if (!api) return Effect.succeed(null)

  return Effect.gen(function* () {
    const result = yield* fetchListingPage(api.url, fetcher)
    const base = baseObservation(target, result, api.provider, checkedAt)
    if (result.status === 404 || result.status === 410) {
      return {
        ...base,
        confidence: 'confirmed',
        evidence: [
          {
            code: 'provider_api',
            detail: `Published posting API returned HTTP ${result.status}`,
            sourceUrl: api.url,
          },
        ],
        outcome: 'closed',
        reasonCode: 'provider_closed',
      }
    }
    if (result.status >= 200 && result.status < 300) {
      return {
        ...base,
        confidence: 'confirmed',
        contentHash: yield* hashListingContent(result.body),
        evidence: [
          {
            code: 'provider_api',
            detail: 'Posting is published by the provider API.',
            sourceUrl: api.url,
          },
        ],
        outcome: 'open',
        reasonCode: 'provider_open',
      }
    }
    return null
  })
}
