import type { CommandReceipt } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { RegistryDatabaseError } from '../errors'

export interface OperationsCrud {
  readonly find: (
    operationId: string
  ) => Effect.Effect<CommandReceipt | undefined, RegistryDatabaseError>
}

export const OperationsCrud = Context.Service<OperationsCrud>(
  '@cv/application-registry-crud/OperationsCrud'
)
