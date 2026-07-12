import { Effect, Layer } from 'effect'

import { RegistryDatabase } from '../../database'
import { findOperation } from '../../persistence/operations'
import { OperationsCrud } from '../../services/operations'

const makeOperationsCrudD1 = Effect.map(RegistryDatabase, (database) =>
  OperationsCrud.of({
    find: (operationId) =>
      database.use(({ query }) => findOperation(query, operationId)),
  })
)

export const OperationsCrudD1Live = Layer.effect(
  OperationsCrud,
  makeOperationsCrudD1
)
