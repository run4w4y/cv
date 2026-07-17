import type { D1Database } from '@cloudflare/workers-types'
import { type Effect, Layer } from 'effect'
import { withRegistryConnections } from '../internal/connection'
import {
  listCompensations,
  replaceAnnualCompensation,
} from '../persistence/compensations'
import { CompensationsCrud } from '../services/compensations'

export const makeCompensationsCrudLive = (
  database: Effect.Effect<D1Database>
) =>
  Layer.succeed(CompensationsCrud, {
    listByApplication: (applicationId) =>
      withRegistryConnections(database, ({ query }) =>
        listCompensations(query, applicationId)
      ),
    replaceAnnual: (applicationId, expectedVersion, replacement, recordedAt) =>
      withRegistryConnections(database, (connections) =>
        replaceAnnualCompensation(
          connections,
          applicationId,
          expectedVersion,
          replacement,
          recordedAt
        )
      ),
  })
