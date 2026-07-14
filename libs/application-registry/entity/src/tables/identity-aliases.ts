import { index, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { applications } from './applications'

export const applicationIdentityAliases = sqliteTable(
  'application_identity_aliases',
  {
    jobKey: text('job_key').notNull(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.jobKey] }),
    index('application_identity_aliases_application_idx').on(
      table.applicationId
    ),
  ]
)
