import { timestamp } from 'drizzle-orm/pg-core'

/**
 * PostgreSQL `timestamptz` stored at millisecond precision while preserving the
 * registry's canonical UTC ISO-string contract at the TypeScript boundary.
 */
export const utcTimestamp = (name: string) =>
  timestamp(name, {
    mode: 'string',
    precision: 3,
    withTimezone: true,
  })
