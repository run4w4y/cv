import { sql } from 'drizzle-orm'
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
} from 'drizzle-orm/sqlite-core'

export const registrySequence = sqliteTable(
  'registry_sequence',
  {
    id: integer('id').notNull(),
    revision: integer('revision').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    check('registry_sequence_singleton_check', sql`${table.id} = 1`),
    check('registry_sequence_revision_check', sql`${table.revision} >= 1`),
  ]
)
