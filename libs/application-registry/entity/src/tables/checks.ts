import { sql } from 'drizzle-orm'

export const sqlStringList = (values: readonly string[]) =>
  sql.raw(values.map((value) => `'${value.replaceAll("'", "''")}'`).join(', '))
