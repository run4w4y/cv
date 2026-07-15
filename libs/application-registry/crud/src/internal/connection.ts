import type { D1Database } from '@cloudflare/workers-types'
import { applicationRegistryRelations } from '@cv/application-registry-entity'
import { D1Client } from '@effect/sql-d1'
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1'
import {
  type EffectSQLiteD1Database,
  makeWithDefaults,
} from 'drizzle-orm/effect-d1'
import { Effect, type Scope } from 'effect'

export type RegistryBatchDatabase = DrizzleD1Database
export type RegistryQueryDatabase = EffectSQLiteD1Database<
  typeof applicationRegistryRelations
>

export interface RegistryConnections {
  readonly batch: RegistryBatchDatabase
  readonly query: RegistryQueryDatabase
}

export const withRegistryConnections = <A, E>(
  binding: Effect.Effect<D1Database>,
  operation: (
    connections: RegistryConnections
  ) => Effect.Effect<A, E, Scope.Scope>
): Effect.Effect<A, E> =>
  Effect.scoped(
    binding.pipe(
      Effect.flatMap((database) =>
        makeWithDefaults({ relations: applicationRegistryRelations }).pipe(
          Effect.provide(D1Client.layer({ db: database })),
          Effect.orDie,
          Effect.flatMap((query) =>
            operation({ batch: drizzle(database), query })
          )
        )
      )
    )
  )
