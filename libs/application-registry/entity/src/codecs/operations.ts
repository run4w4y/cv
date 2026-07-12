import { createSelectSchema } from 'drizzle-orm/effect-schema'
import type { Schema } from 'effect'

import { UtcIsoTimestampSchema } from '../model/constraints'
import { commandReceipts } from '../tables/operations'

export const CommandReceiptSchema = createSelectSchema(commandReceipts, {
  recordedAt: () => UtcIsoTimestampSchema,
})

export type CommandReceipt = Schema.Schema.Type<typeof CommandReceiptSchema>
