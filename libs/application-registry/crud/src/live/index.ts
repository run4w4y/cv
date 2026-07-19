import type { D1Database } from '@cloudflare/workers-types'
import { type Effect, Layer } from 'effect'
import { makeActivitiesCrudLive } from './activities'
import { makeAnnotationsCrudLive } from './annotations'
import { makeApplicationsCrudLive } from './applications'
import { makeCompensationsCrudLive } from './compensations'
import { makeContentCrudLive } from './content'
import { makeCvAnalyticsCrudLive } from './cv-analytics'
import { makeFxRatesCrudLive } from './fx-rates'
import { makeListingChecksCrudLive } from './listing-checks'
import { makeIdempotencyCrudLive } from './operations'

export const makeRegistryCrudLive = (database: Effect.Effect<D1Database>) =>
  Layer.mergeAll(
    makeAnnotationsCrudLive(database),
    makeActivitiesCrudLive(database),
    makeApplicationsCrudLive(database),
    makeCompensationsCrudLive(database),
    makeContentCrudLive(database),
    makeCvAnalyticsCrudLive(database),
    makeFxRatesCrudLive(database),
    makeListingChecksCrudLive(database),
    makeIdempotencyCrudLive(database)
  )

export { makeContentCrudLive } from './content'
export { makeCvAnalyticsCrudLive } from './cv-analytics'
