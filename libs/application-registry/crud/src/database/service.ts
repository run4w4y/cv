import type { DrizzleD1Database } from 'drizzle-orm/d1'
import type { EffectSQLiteD1Database } from 'drizzle-orm/effect-d1'
import { Context, type Effect, type Scope } from 'effect'

export type RegistryQueryDatabase = EffectSQLiteD1Database
export type RegistryBatchDatabase = DrizzleD1Database

export interface RegistryConnections {
  readonly batch: RegistryBatchDatabase
  readonly query: RegistryQueryDatabase
}

export interface RegistryDatabase {
  readonly use: <A, E, R>(
    operation: (
      connections: RegistryConnections
    ) => Effect.Effect<A, E, R | Scope.Scope>
  ) => Effect.Effect<A, E, R>
}

export const RegistryDatabase = Context.Service<RegistryDatabase>(
  '@cv/application-registry-crud/d1/RegistryDatabase'
)
