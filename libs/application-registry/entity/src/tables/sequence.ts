import { sql } from 'drizzle-orm'
import { check, integer, pgTable, primaryKey } from 'drizzle-orm/pg-core'

export const registrySequence = pgTable(
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
