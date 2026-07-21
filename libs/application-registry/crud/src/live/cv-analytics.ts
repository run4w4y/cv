import { Layer } from 'effect'

import type { RegistryDatabase } from '../internal/connection'
import { listCvAnalyticsLinks } from '../persistence/cv-analytics'
import { CvAnalyticsCrud } from '../services/cv-analytics'

export const makeCvAnalyticsCrudLive = (database: RegistryDatabase) =>
  Layer.succeed(CvAnalyticsCrud, {
    listLinks: () => listCvAnalyticsLinks(database),
  })
