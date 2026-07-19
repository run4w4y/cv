import assert from 'node:assert/strict'
import { stat } from 'node:fs/promises'
import { afterEach, test } from 'node:test'
import {
  applicationEvents,
  applications,
  registrySequence,
} from '@cv/application-registry-entity'
import { drizzle } from 'drizzle-orm/d1'

import {
  makeRegistryFactory,
  RegistryMiniflareHarness,
  seedRegistryDatabase,
} from '../src/application-registry'
import {
  MiniflareTestEnvironment,
  readD1MigrationPlan,
  resetKVNamespace,
  resetR2Bucket,
} from '../src/miniflare'

const harnesses: RegistryMiniflareHarness[] = []

afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.dispose()))
})

test('migrates and bulk-seeds beyond one D1 batch with entity mappings', async () => {
  const harness = await RegistryMiniflareHarness.make()
  harnesses.push(harness)
  const graph = makeRegistryFactory({ seed: 101 }).graph({
    applicationCount: 101,
    eventsPerApplication: 1,
  })

  await seedRegistryDatabase(harness.database, graph)
  assert.deepEqual(
    await harness.query<{ readonly count: number }>(
      'select count(*) as count from applications'
    ),
    [{ count: 101 }]
  )
  assert.deepEqual(
    await harness.query<{ readonly count: number }>(
      'select count(*) as count from application_events'
    ),
    [{ count: 101 }]
  )

  const connection = drizzle(harness.database)
  const [application] = await connection
    .select({
      listingAvailability: applications.listingAvailability,
      version: applications.version,
    })
    .from(applications)
    .orderBy(applications.updatedRevision)
    .limit(1)
  assert.deepEqual(application, {
    listingAvailability: 'unchecked',
    version: 1,
  })

  const [event] = await connection
    .select({ payload: applicationEvents.payload })
    .from(applicationEvents)
    .orderBy(applicationEvents.revision)
    .limit(1)
  assert.deepEqual(event?.payload, {
    applicationIndex: 0,
    eventIndex: 0,
  })

  const [sequence] = await connection
    .select({ revision: registrySequence.revision })
    .from(registrySequence)
  assert.equal(sequence?.revision, 101)

  const emptyGraph = makeRegistryFactory({ seed: 102 }).graph({
    applicationCount: 0,
    eventsPerApplication: 0,
  })
  await seedRegistryDatabase(harness.database, emptyGraph)
  assert.deepEqual(
    await harness.query<{ readonly revision: number }>(
      'select revision from registry_sequence'
    ),
    [{ revision: 101 }]
  )

  await harness.reset()
  assert.deepEqual(
    await harness.query<{ readonly count: number }>(
      'select count(*) as count from applications'
    ),
    [{ count: 0 }]
  )

  await seedRegistryDatabase(harness.database, emptyGraph)
  assert.deepEqual(
    await harness.query<{ readonly revision: number }>(
      'select revision from registry_sequence'
    ),
    [{ revision: 1 }]
  )
})

test('can advance a database created at an earlier migration', async () => {
  const migrations = readD1MigrationPlan({
    migrationsPath: new URL(
      '../../application-registry/entity/drizzle',
      import.meta.url
    ).pathname,
  })
  const firstMigration = migrations[0]
  assert.ok(firstMigration)
  const harness = await RegistryMiniflareHarness.make({
    throughMigration: firstMigration.name,
  })
  harnesses.push(harness)

  await harness.migrateAfter(firstMigration.name)
  const finalTable = await harness.query<{ readonly name: string }>(
    `select name from sqlite_master
     where type = 'table' and name = 'generated_artifacts'`
  )
  assert.deepEqual(finalTable, [{ name: 'generated_artifacts' }])
})

test('removes temporary persistence when disposed', async () => {
  const environment = await MiniflareTestEnvironment.make(
    {
      d1Databases: { DB: 'cleanup-test' },
      modules: true,
      script: 'export default { fetch: () => new Response(null) }',
    },
    { persist: ['d1'] }
  )
  const persistPath = environment.persistPath
  assert.ok(persistPath)
  await stat(persistPath)

  await environment.dispose()
  await assert.rejects(stat(persistPath), { code: 'ENOENT' })
})

test('resets KV and R2 data without recreating the environment', async () => {
  const environment = await MiniflareTestEnvironment.make({
    kvNamespaces: { CACHE: 'storage-reset-cache' },
    modules: true,
    r2Buckets: { OBJECTS: 'storage-reset-objects' },
    script: 'export default { fetch: () => new Response(null) }',
  })

  try {
    const namespace = await environment.miniflare.getKVNamespace('CACHE')
    const bucket = await environment.miniflare.getR2Bucket('OBJECTS')
    await Promise.all([
      namespace.put('cached', 'value'),
      bucket.put('document.json', '{}'),
    ])

    await Promise.all([resetKVNamespace(namespace), resetR2Bucket(bucket)])
    assert.equal(await namespace.get('cached'), null)
    assert.equal(await bucket.get('document.json'), null)
  } finally {
    await environment.dispose()
  }
})
