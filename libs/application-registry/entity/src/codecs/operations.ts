import { createSelectSchema } from 'drizzle-orm/effect-schema'
import type { Schema } from 'effect'

import { UtcIsoTimestampSchema } from '../model/constraints'
import { idempotencyReceipts } from '../tables/operations'

export const IdempotencyReceiptSchema = createSelectSchema(
  idempotencyReceipts,
  {
    createdAt: () => UtcIsoTimestampSchema,
  }
)

export type IdempotencyReceipt = Schema.Schema.Type<
  typeof IdempotencyReceiptSchema
>
