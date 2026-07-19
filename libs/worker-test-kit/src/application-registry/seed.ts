import type { D1Database } from '@cloudflare/workers-types'
import type { CreateApplicationRequest } from '@cv/application-registry-api-contract'
import {
  applicationActivities,
  applications,
  registrySequence,
} from '@cv/application-registry-entity'
import { sql } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1'

import type { RegistryFactory, RegistrySeedGraph } from './factories'

export interface RegistryServiceSeedOptions<Result> {
  readonly applicationCount: number
  readonly applicationOverrides?: (
    index: number
  ) => Partial<CreateApplicationRequest>
  readonly concurrency?: number
  readonly factory: RegistryFactory
  readonly persist: (
    input: CreateApplicationRequest,
    index: number
  ) => Promise<Result>
}

export interface RegistryServiceSeedResult<Result> {
  readonly inputs: readonly CreateApplicationRequest[]
  readonly results: readonly Result[]
}

const nonNegativeInteger = (value: number, label: string) => {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer.`)
  }
}

/** Generates valid inputs and persists them through a real service boundary. */
export const seedRegistryThroughService = async <Result>(
  options: RegistryServiceSeedOptions<Result>
): Promise<RegistryServiceSeedResult<Result>> => {
  nonNegativeInteger(options.applicationCount, 'applicationCount')
  const concurrency = options.concurrency ?? 1
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('concurrency must be a positive integer.')
  }

  const inputs = Array.from({ length: options.applicationCount }, (_, index) =>
    options.factory.application(options.applicationOverrides?.(index))
  )
  const results: Result[] = []
  for (let index = 0; index < inputs.length; index += concurrency) {
    const current = inputs.slice(index, index + concurrency)
    results.push(
      ...(await Promise.all(
        current.map((input, offset) => options.persist(input, index + offset))
      ))
    )
  }

  return { inputs, results }
}

const batch = async (
  database: DrizzleD1Database,
  statements: readonly BatchItem<'sqlite'>[],
  batchSize = 100
) => {
  for (let index = 0; index < statements.length; index += batchSize) {
    const current = statements.slice(index, index + batchSize)
    const first = current[0]
    if (first !== undefined) {
      await database.batch([first, ...current.slice(1)])
    }
  }
}

/** Inserts a deterministic graph directly for query and pagination tests. */
export const seedRegistryDatabase = async (
  database: D1Database,
  graph: RegistrySeedGraph
) => {
  const connection = drizzle(database)
  const applicationStatements = graph.applications.map((application) =>
    connection.insert(applications).values(application)
  )
  await batch(connection, applicationStatements)

  const activityStatements = graph.activities.map((activity) =>
    connection.insert(applicationActivities).values(activity)
  )
  await batch(connection, activityStatements)

  const maximumRevision = Math.max(
    1,
    ...graph.applications.map(({ updatedRevision }) => updatedRevision),
    ...graph.activities.map(({ revision }) => revision)
  )
  await connection
    .insert(registrySequence)
    .values({ id: 1, revision: maximumRevision })
    .onConflictDoUpdate({
      target: registrySequence.id,
      set: {
        revision: sql`max(${registrySequence.revision}, excluded.revision)`,
      },
    })
}
