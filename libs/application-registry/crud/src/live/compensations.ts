import { Layer } from 'effect'
import type { RegistryDatabase } from '../internal/connection'
import { listCompensations } from '../persistence/compensations'
import { CompensationsCrud } from '../services/compensations'

export const makeCompensationsCrudLive = (database: RegistryDatabase) =>
  Layer.succeed(CompensationsCrud, {
    listByApplication: (applicationId) =>
      listCompensations(database, applicationId),
  })
