import type { D1Database } from '@cloudflare/workers-types'
import { type Effect, Layer } from 'effect'

import { makeAnnotationsCrudLive } from './annotations'
import { makeApplicationsCrudLive } from './applications'
import { makeCapturesCrudLive } from './captures'
import { makeCompensationsCrudLive } from './compensations'
import { makeEventsCrudLive } from './events'
import { makeFxRatesCrudLive } from './fx-rates'
import { makeListingChecksCrudLive } from './listing-checks'
import { makeOperationsCrudLive } from './operations'

export const makeRegistryCrudLive = (database: Effect.Effect<D1Database>) =>
  Layer.mergeAll(
    makeAnnotationsCrudLive(database),
    makeApplicationsCrudLive(database),
    makeCapturesCrudLive(database),
    makeCompensationsCrudLive(database),
    makeEventsCrudLive(database),
    makeFxRatesCrudLive(database),
    makeListingChecksCrudLive(database),
    makeOperationsCrudLive(database)
  )
