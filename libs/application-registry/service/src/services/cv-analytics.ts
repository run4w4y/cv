import { Context, type Effect } from 'effect'

import type {
  RegistryAnalyticsError,
  RegistryBadRequestError,
  RegistryDatabaseError,
} from '../errors'
import type {
  CvAnalyticsRangeInput,
  CvAnalyticsResult,
  CvAnalyticsTrafficAlias,
  CvAnalyticsTrafficCapabilities,
  CvAnalyticsTrafficData,
} from '../types'

export interface CvAnalyticsTrafficSource {
  readonly capabilities: () => Effect.Effect<
    CvAnalyticsTrafficCapabilities,
    RegistryAnalyticsError
  >
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
  readonly read: (
    input: CvAnalyticsRangeInput
  ) => Effect.Effect<
    CvAnalyticsResult,
    RegistryAnalyticsError | RegistryBadRequestError | RegistryDatabaseError
  >
}

export const CvAnalyticsService = Context.Service<CvAnalyticsService>(
  '@cv/application-registry-service/CvAnalyticsService'
)
