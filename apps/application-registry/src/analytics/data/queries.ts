import type { CvAnalyticsQuery } from '@cv/application-registry-api-contract'
import * as Atom from 'effect/unstable/reactivity/Atom'
import * as Reactivity from 'effect/unstable/reactivity/Reactivity'

import { RegistryClient, registryQuery } from '../../lib/registry-client'

export type CvAnalyticsDays = NonNullable<CvAnalyticsQuery['days']>
export type CvAnalyticsRangeKey =
  | `days:${CvAnalyticsDays}`
  | `custom:${string}:${string}`

export const cvAnalyticsPresetRangeKey = (
  days: CvAnalyticsDays
): CvAnalyticsRangeKey => `days:${days}`

export const cvAnalyticsCustomRangeKey = (
  from: string,
  to: string
): CvAnalyticsRangeKey => `custom:${from}:${to}`

export const cvAnalyticsQueryFromRangeKey = (
  rangeKey: CvAnalyticsRangeKey
): CvAnalyticsQuery => {
  if (rangeKey.startsWith('days:')) {
    return { days: Number(rangeKey.slice(5)) as CvAnalyticsDays }
  }

  const [, from, to] = rangeKey.split(':')
  if (!from || !to) {
    throw new Error(`Invalid CV analytics range key: ${rangeKey}`)
  }
  return { from, to }
}

const cvAnalyticsReactivityKey = 'cv-analytics'

export const cvAnalyticsAtom = Atom.family((rangeKey: CvAnalyticsRangeKey) =>
  registryQuery('getCvAnalytics', {
    query: cvAnalyticsQueryFromRangeKey(rangeKey),
    reactivityKeys: [cvAnalyticsReactivityKey],
    serializationKey: `cv-analytics:${rangeKey}`,
    timeToLive: '5 minutes',
  }).pipe(
    Atom.swr({
      staleTime: '1 minute',
      revalidateOnFocus: false,
      revalidateOnMount: true,
    })
  )
)

export const refreshCvAnalytics = RegistryClient.runtime.fn(() =>
  Reactivity.invalidate([cvAnalyticsReactivityKey])
)
