import type { CvAnalyticsQuery } from '@cv/application-registry-api-contract'
import * as Atom from 'effect/unstable/reactivity/Atom'
import * as Reactivity from 'effect/unstable/reactivity/Reactivity'

import { RegistryClient, registryQuery } from '../../lib/registry-client'

export type CvAnalyticsDays = NonNullable<CvAnalyticsQuery['days']>

const cvAnalyticsReactivityKey = 'cv-analytics'

export const cvAnalyticsAtom = Atom.family((days: CvAnalyticsDays) =>
  registryQuery('getCvAnalytics', {
    query: { days },
    reactivityKeys: [cvAnalyticsReactivityKey],
    serializationKey: `cv-analytics:${days}`,
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
