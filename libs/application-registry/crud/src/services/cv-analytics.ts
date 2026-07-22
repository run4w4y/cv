import { Context, type Effect } from 'effect'

import type { RegistryDatabaseError } from '../errors'
import type { CvAnalyticsLinkRecord } from '../types'

export interface CvAnalyticsCrud {
  readonly listLinks: () => Effect.Effect<
    readonly CvAnalyticsLinkRecord[],
    RegistryDatabaseError
  >
}

export const CvAnalyticsCrud = Context.Service<CvAnalyticsCrud>(
  '@cv/application-registry-crud/CvAnalyticsCrud'
)
