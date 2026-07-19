import type { D1Database } from '@cloudflare/workers-types'
import { type Effect, Layer } from 'effect'

import { withRegistryConnections } from '../internal/connection'
import { listCvAnalyticsLinks } from '../persistence/cv-analytics'
import { CvAnalyticsCrud } from '../services/cv-analytics'

export const makeCvAnalyticsCrudLive = (database: Effect.Effect<D1Database>) =>
  Layer.succeed(CvAnalyticsCrud, {
    listLinks: () =>
      withRegistryConnections(database, ({ query }) =>
        listCvAnalyticsLinks(query)
      ),
  })
