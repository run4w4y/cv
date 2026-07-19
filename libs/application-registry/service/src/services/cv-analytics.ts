import { Context, type Effect } from 'effect'

import type { RegistryAnalyticsError, RegistryDatabaseError } from '../errors'
import type {
  CvAnalyticsDays,
  CvAnalyticsResult,
  CvAnalyticsTrafficAlias,
  CvAnalyticsTrafficData,
} from '../types'

export interface CvAnalyticsTrafficSource {
  readonly read: (
    aliases: readonly CvAnalyticsTrafficAlias[],
    range: { readonly from: string; readonly to: string }
  ) => Effect.Effect<CvAnalyticsTrafficData, RegistryAnalyticsError>
}

export const CvAnalyticsTrafficSource =
  Context.Service<CvAnalyticsTrafficSource>(
    '@cv/application-registry-service/CvAnalyticsTrafficSource'
  )

export interface CvAnalyticsService {
  readonly read: (input: {
    readonly days?: CvAnalyticsDays
  }) => Effect.Effect<
    CvAnalyticsResult,
    RegistryAnalyticsError | RegistryDatabaseError
  >
}

export const CvAnalyticsService = Context.Service<CvAnalyticsService>(
  '@cv/application-registry-service/CvAnalyticsService'
)
