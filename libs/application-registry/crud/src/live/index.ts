import { Effect, Layer } from 'effect'
import {
  RegistryDatabase,
  RegistryDatabaseLive,
  type RegistryDatabase as RegistryDatabaseShape,
} from '../internal/connection'
import { makeActivitiesCrudLive } from './activities'
import { makeAnnotationsCrudLive } from './annotations'
import { makeApplicationsCrudLive } from './applications'
import { makeCompensationsCrudLive } from './compensations'
import { makeContentCrudLive } from './content'
import { makeCvAnalyticsCrudLive } from './cv-analytics'
import { makeListingChecksCrudLive } from './listing-checks'
import { makeIdempotencyCrudLive } from './operations'

/** Injectable CRUD layer constructor used by integration tests. */
export const makeRegistryCrudLive = (database: RegistryDatabaseShape) =>
  Layer.mergeAll(
    makeAnnotationsCrudLive(database),
    makeActivitiesCrudLive(database),
    makeApplicationsCrudLive(database),
    makeCompensationsCrudLive(database),
    makeContentCrudLive(database),
    makeCvAnalyticsCrudLive(database),
    makeListingChecksCrudLive(database),
    makeIdempotencyCrudLive(database)
  )

/** Production CRUD layer backed by the scoped PostgreSQL client. */
export const RegistryCrudLive = Layer.unwrap(
  RegistryDatabase.pipe(Effect.map(makeRegistryCrudLive))
).pipe(Layer.provide(RegistryDatabaseLive))

export {
  makeRegistryDatabase,
  RegistryDatabase,
  type RegistryDatabase as RegistryDatabaseShape,
  RegistryDatabaseLive,
  type RegistryExecutor,
  type RegistryTransaction,
  registryPgCodecs,
} from '../internal/connection'
export { makeContentCrudLive } from './content'
export { makeCvAnalyticsCrudLive } from './cv-analytics'
