import type { D1Database } from '@cloudflare/workers-types'
import { D1Client } from '@effect/sql-d1'
import { drizzle } from 'drizzle-orm/d1'
import { makeWithDefaults } from 'drizzle-orm/effect-d1'
import { Effect, Layer } from 'effect'

import { RegistryDatabase } from '../../database'

const makeRegistryDatabaseD1 = (binding: D1Database) =>
  makeWithDefaults({}).pipe(
    Effect.map((query) => {
      const connections = { batch: drizzle(binding), query }

      return RegistryDatabase.of({
        use: (operation) => Effect.scoped(operation(connections)),
      })
    })
  )

export const registryDatabaseD1Layer = (binding: D1Database) =>
  Layer.effect(RegistryDatabase, makeRegistryDatabaseD1(binding)).pipe(
    Layer.provide(D1Client.layer({ db: binding })),
    Layer.orDie
  )
