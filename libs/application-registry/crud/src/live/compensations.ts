import { Layer } from 'effect'
import type { RegistryDatabase } from '../internal/connection'
import {
  listCompensations,
  replaceAnnualCompensation,
} from '../persistence/compensations'
import { CompensationsCrud } from '../services/compensations'

export const makeCompensationsCrudLive = (database: RegistryDatabase) =>
  Layer.succeed(CompensationsCrud, {
    listByApplication: (applicationId) =>
      listCompensations(database, applicationId),
    replaceAnnual: (applicationId, expectedVersion, replacement, recordedAt) =>
      replaceAnnualCompensation(
        database,
        applicationId,
        expectedVersion,
        replacement,
        recordedAt
      ),
  })
