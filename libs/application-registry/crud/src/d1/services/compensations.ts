import { Effect, Layer } from 'effect'

import { RegistryDatabase } from '../../database'
import { listCompensations } from '../../persistence/compensations'
import { CompensationsCrud } from '../../services/compensations'

const makeCompensationsCrudD1 = Effect.map(RegistryDatabase, (database) =>
  CompensationsCrud.of({
    listByApplication: (applicationId) =>
      database.use(({ query }) => listCompensations(query, applicationId)),
  })
)

export const CompensationsCrudD1Live = Layer.effect(
  CompensationsCrud,
  makeCompensationsCrudD1
)
