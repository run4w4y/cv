import type { IdempotencyReceipt } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { RegistryDatabaseError } from '../errors'

export interface IdempotencyCrud {
  readonly find: (
    idempotencyKey: string
  ) => Effect.Effect<IdempotencyReceipt | undefined, RegistryDatabaseError>
}

export const IdempotencyCrud = Context.Service<IdempotencyCrud>(
  '@cv/application-registry-crud/IdempotencyCrud'
)
