import { registrySequence } from '@cv/application-registry-entity'
import { sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { Effect } from 'effect'

import type { RegistryBatchDatabase } from '../database'
import { RegistryDatabaseError } from '../errors'

export const currentRevision = sql<number>`(
  select ${registrySequence.revision}
  from ${registrySequence}
  where ${registrySequence.id} = 1
)`

export const allocateRevision = (database: RegistryBatchDatabase) =>
  database
    .insert(registrySequence)
    .values({ id: 1, revision: 1 })
    .onConflictDoUpdate({
      target: registrySequence.id,
      set: { revision: sql`${registrySequence.revision} + 1` },
    })

export const runBatch = (
  database: RegistryBatchDatabase,
  operation: string,
  statements: readonly [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]
) =>
  Effect.tryPromise({
    try: () => database.batch(statements),
    catch: (cause) =>
      new RegistryDatabaseError({
        cause,
        message: `Failed to execute ${operation}`,
      }),
  })

export const normalizeCompany = (company: string) =>
  company.trim().toLocaleLowerCase('en-US')
