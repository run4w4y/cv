import type { D1Database } from '@cloudflare/workers-types'
import { type Effect, Layer } from 'effect'

import { makeAnnotationsCrudLive } from './annotations'
import { makeApplicationsCrudLive } from './applications'
import { makeCompensationsCrudLive } from './compensations'
import { makeContentCrudLive } from './content'
import { makeCvAnalyticsCrudLive } from './cv-analytics'
import { makeEventsCrudLive } from './events'
import { makeFxRatesCrudLive } from './fx-rates'
import { makeListingChecksCrudLive } from './listing-checks'
import { makeOperationsCrudLive } from './operations'

export const makeRegistryCrudLive = (database: Effect.Effect<D1Database>) =>
  Layer.mergeAll(
    makeAnnotationsCrudLive(database),
    makeApplicationsCrudLive(database),
    makeCompensationsCrudLive(database),
    makeContentCrudLive(database),
    makeCvAnalyticsCrudLive(database),
    makeEventsCrudLive(database),
    makeFxRatesCrudLive(database),
    makeListingChecksCrudLive(database),
    makeOperationsCrudLive(database)
  )

export { makeContentCrudLive } from './content'
export { makeCvAnalyticsCrudLive } from './cv-analytics'
