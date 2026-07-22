import assert from 'node:assert/strict'
import { after, afterEach, before, test } from 'node:test'
import {
  type StartedPostgresTestContainer,
  startPostgresTestContainer,
} from '@cv/test-infrastructure/postgres'
import { PgClient } from '@effect/sql-pg'
import { Effect, Exit, ManagedRuntime, Redacted } from 'effect'

import type { D1SourceSnapshot } from '../src/d1-source.ts'
import { type RegistryTableName, registryTables } from '../src/manifest.ts'
import { applyRegistrySchema } from '../src/postgres-schema.ts'
import {
  importD1IntoPostgres,
  type PostgresImportConfiguration,
} from '../src/postgres-target.ts'
import type { RegistryRow } from '../src/transform.ts'

const recordedAt = '2026-07-20T12:00:00.000Z'
const completedAt = '2026-07-20T12:01:00.000Z'
const dueAt = '2026-07-21T12:00:00.000Z'

const fixtureRows = {
  applications: [
    {
      id: 'application-1',
      posting_url: 'https://example.test/jobs/effect-engineer',
      posting_url_normalized: 'https://example.test/jobs/effect-engineer',
      posting_fingerprint: 'example.test/jobs/effect-engineer',
      company: 'Example Company',
      role: 'Effect Engineer',
      location: 'Remote',
      application_status: 'applied',
      target_stage: 'apply_next',
      personal_priority: 'high',
      follow_up_at: dueAt,
      applied_at: recordedAt,
      listing_availability: 'open',
      listing_confidence: 'high',
      listing_reason_code: 'provider_open',
      listing_checked_at: completedAt,
      listing_closed_candidate_at: null,
      listing_consecutive_closed_checks: 0,
      version: 2,
      updated_revision: 11,
      created_at: recordedAt,
      updated_at: completedAt,
    },
  ],
  registry_sequence: [{ id: 1, revision: 11 }],
  listing_check_runs: [
    {
      id: 'listing-run-1',
      trigger: 'scheduled',
      mode: 'report',
      state: 'completed',
      selected_count: 1,
      checked_count: 1,
      open_count: 1,
      closed_count: 0,
      review_count: 0,
      error_count: 0,
      started_at: recordedAt,
      completed_at: completedAt,
      failed_at: null,
      failure_code: null,
      failure_message: null,
    },
  ],
  application_activities: [
    {
      id: 'activity-1',
      application_id: 'application-1',
      kind: 'application_created',
      actor: 'migration',
      source: 'migration',
      revision: 10,
      occurred_at: recordedAt,
      payload: { imported: true, labels: ['postgres', 'effect'] },
    },
  ],
  application_labels: [
    {
      application_id: 'application-1',
      label: 'postgres',
      created_at: recordedAt,
    },
  ],
  application_notes: [
    {
      id: 'note-1',
      application_id: 'application-1',
      kind: 'summary',
      body: 'Synthetic importer integration fixture.',
      source: 'migration',
      created_at: recordedAt,
      updated_at: recordedAt,
    },
  ],
  application_compensations: [
    {
      id: 'compensation-1',
      application_id: 'application-1',
      kind: 'base_salary',
      currency_code: 'USD',
      minimum_minor: 3_000_000_000,
      maximum_minor: 4_000_000_000,
      period: 'year',
      raw_text: '$100k-$120k',
      source: 'migration',
      created_at: recordedAt,
      updated_at: recordedAt,
    },
  ],
  application_listing_check_schedules: [
    {
      application_id: 'application-1',
      due_at: dueAt,
      lease_token: null,
      lease_until: null,
      attempt_count: 1,
      last_error: null,
      updated_at: completedAt,
    },
  ],
  idempotency_receipts: [
    {
      idempotency_key: 'listing-check-1',
      request_hash: 'request-hash-1',
      scope: 'listing_check',
      application_id: 'application-1',
      resource_id: 'listing-check-1',
      created_at: completedAt,
    },
  ],
  job_posting_snapshots: [
    {
      id: 'job-snapshot-1',
      application_id: 'application-1',
      requested_url: 'https://example.test/jobs/effect-engineer',
      final_url: 'https://example.test/jobs/effect-engineer',
      status: 'fetched',
      fetched_at: completedAt,
      fetcher_version: 'integration-v1',
      raw_object_key: 'job-postings/raw/job-snapshot-1.html',
      raw_sha256: 'a'.repeat(64),
      raw_byte_length: 512,
      raw_media_type: 'text/html',
      normalized_object_key: 'job-postings/normalized/job-snapshot-1.txt',
      normalized_sha256: 'b'.repeat(64),
      normalized_byte_length: 256,
      normalized_media_type: 'text/plain',
      error_code: null,
      error_message: null,
    },
  ],
  application_listing_checks: [
    {
      id: 'listing-check-1',
      application_id: 'application-1',
      run_id: 'listing-run-1',
      operation_id: 'listing-operation-1',
      requested_url: 'https://example.test/jobs/effect-engineer',
      final_url: 'https://example.test/jobs/effect-engineer',
      provider: 'integration',
      outcome: 'open',
      confidence: 'high',
      recommended_action: 'keep',
      reason_code: 'provider_open',
      http_status: 200,
      evidence: [{ kind: 'status', value: 'open' }],
      content_hash: 'content-hash-1',
      checker_version: 'integration-v1',
      checked_at: completedAt,
      received_at: completedAt,
      next_check_at: dueAt,
    },
  ],
  content_entries: [
    {
      id: 'content-entry-1',
      application_id: 'application-1',
      kind: 'cv',
      locale: 'en',
      state: 'approved',
      head_revision_id: 'content-revision-1',
      approved_revision_id: 'content-revision-1',
      version: 1,
      created_at: recordedAt,
      updated_at: completedAt,
    },
  ],
  content_revisions: [
    {
      id: 'content-revision-1',
      content_entry_id: 'content-entry-1',
      revision_number: 1,
      parent_revision_id: null,
      contract_id: 'cv-contract',
      contract_version: '1',
      object_key: 'content/content-revision-1.json',
      sha256: 'c'.repeat(64),
      byte_length: 1024,
      media_type: 'application/json',
      source: 'migration',
      facts_release_id: 'facts-release-1',
      job_snapshot_id: 'job-snapshot-1',
      operation_id: 'content-operation-1',
      created_at: recordedAt,
    },
  ],
  cv_links: [
    {
      id: 'cv-link-1',
      application_id: 'application-1',
      content_entry_id: 'content-entry-1',
      current_revision_id: 'content-revision-1',
      token: 'public-token-1',
      preview_token: 'preview-token-1',
      public_url: 'https://cv.example.test/public-token-1',
      enabled: true,
      disabled_reason: null,
      disabled_at: null,
      publication_version: 1,
      version: 1,
      created_at: recordedAt,
      updated_at: completedAt,
    },
  ],
  generated_artifacts: [
    {
      id: 'artifact-1',
      cv_link_id: 'cv-link-1',
      content_revision_id: 'content-revision-1',
      kind: 'pdf',
      status: 'pending',
      request_id: 'pdf-request-1',
      renderer_version: 'chromium-integration-v1',
      publication_version: 1,
      qr_target: 'https://cv.example.test/public-token-1',
      object_key: null,
      sha256: null,
      byte_length: null,
      media_type: null,
      error_code: null,
      error_message: null,
      generated_at: null,
      created_at: recordedAt,
      updated_at: recordedAt,
    },
  ],
} satisfies Record<RegistryTableName, readonly RegistryRow[]>

const makeSnapshot = (
  rows: ReadonlyMap<string, readonly RegistryRow[]> = new Map(
    Object.entries(fixtureRows)
  ),
  sha256 = 'd'.repeat(64)
): D1SourceSnapshot => ({
  diagnostics: {
    retiredTableRows: { fx_rates: 0, pdf_generation_outbox: 0 },
    runningListingCheckRuns: 0,
  },
  migrations: [],
  rows,
  sha256,
})

const expectedCounts = Object.fromEntries(
  registryTables.map(({ name }) => [name, 1])
)

const makeRuntime = (config: PostgresImportConfiguration) =>
  ManagedRuntime.make(
    PgClient.layer({
      applicationName: 'cv-registry-d1-import-integration-test',
      database: config.database,
      host: config.host,
      maxConnections: config.maxConnections,
      password: config.password,
      port: config.port,
      username: config.username,
    })
  )

type Runtime = ReturnType<typeof makeRuntime>

class PostgresImportHarness {
  readonly config: PostgresImportConfiguration

  readonly #container: StartedPostgresTestContainer
  readonly #runtime: Runtime

  private constructor(
    container: StartedPostgresTestContainer,
    config: PostgresImportConfiguration,
    runtime: Runtime
  ) {
    this.#container = container
    this.config = config
    this.#runtime = runtime
  }

  static async make(): Promise<PostgresImportHarness> {
    const container = await startPostgresTestContainer({
      database: 'application_registry_import',
      password: 'registry-import-test',
      username: 'registry_import',
    })
    const config: PostgresImportConfiguration = {
      database: container.database,
      host: container.host,
      maxConnections: 4,
      password: Redacted.make(container.password),
      port: container.port,
      username: container.username,
    }
    const runtime = makeRuntime(config)

    try {
      await Effect.runPromise(applyRegistrySchema(config))
      return new PostgresImportHarness(container, config, runtime)
    } catch (error) {
      await runtime.dispose()
      await container.dispose()
      throw error
    }
  }

  query<A extends object>(
    statement: string,
    parameters: ReadonlyArray<unknown> = []
  ): Promise<ReadonlyArray<A>> {
    return this.#runtime.runPromise(
      Effect.gen(function* () {
        const client = yield* PgClient.PgClient
        return yield* client.unsafe<A>(statement, parameters)
      })
    )
  }

  async counts(): Promise<Readonly<Record<string, number>>> {
    const entries = await Promise.all(
      registryTables.map(async ({ name }) => {
        const rows = await this.query<{ count: number }>(
          `select count(*)::integer as count from "${name}"`
        )
        return [name, rows.at(0)?.count ?? -1] as const
      })
    )
    return Object.fromEntries(entries)
  }

  async reset(): Promise<void> {
    await this.query(
      `truncate table ${registryTables.map(({ name }) => `"${name}"`).join(', ')} cascade`
    )
  }

  async dispose(): Promise<void> {
    await this.#runtime.dispose()
    await this.#container.dispose()
  }
}

let harness: PostgresImportHarness

before(async () => {
  assert.equal(registryTables.length, 15)
  harness = await PostgresImportHarness.make()
})

afterEach(async () => {
  await harness.reset()
})

after(async () => {
  await harness.dispose()
})

test('imports every registry table and treats an exact rerun as a no-op', async () => {
  const snapshot = makeSnapshot()
  const first = await Effect.runPromise(
    importD1IntoPostgres(snapshot, harness.config)
  )

  assert.equal(first.alreadyImported, false)
  assert.equal(first.sourceSha256, snapshot.sha256)
  assert.deepEqual(first.counts, expectedCounts)
  assert.deepEqual(await harness.counts(), expectedCounts)

  const rerun = await Effect.runPromise(
    importD1IntoPostgres(snapshot, harness.config)
  )
  assert.equal(rerun.alreadyImported, true)
  assert.deepEqual(rerun.counts, expectedCounts)
  assert.deepEqual(await harness.counts(), expectedCounts)

  const [nativeValues] = await harness.query<{
    enabled: boolean
    evidence: unknown
    payload: unknown
  }>(`
    select links.enabled, checks.evidence, activities.payload
    from cv_links links
    inner join application_listing_checks checks on true
    inner join application_activities activities on true
  `)
  assert.deepEqual(nativeValues, {
    enabled: true,
    evidence: [{ kind: 'status', value: 'open' }],
    payload: { imported: true, labels: ['postgres', 'effect'] },
  })
})

test('rejects a mutated target without changing it', async () => {
  const snapshot = makeSnapshot()
  await Effect.runPromise(importD1IntoPostgres(snapshot, harness.config))
  await harness.query('update applications set company = $1 where id = $2', [
    'Tampered Company',
    'application-1',
  ])

  const exit = await Effect.runPromiseExit(
    importD1IntoPostgres(snapshot, harness.config)
  )
  assert.equal(Exit.isFailure(exit), true)

  const companies = await harness.query<{ company: string }>(
    'select company from applications where id = $1',
    ['application-1']
  )
  assert.deepEqual(companies, [{ company: 'Tampered Company' }])
  assert.deepEqual(await harness.counts(), expectedCounts)
})

test('rejects a partially occupied target without filling missing tables', async () => {
  await harness.query(
    'insert into registry_sequence (id, revision) values ($1, $2)',
    [1, 11]
  )

  const exit = await Effect.runPromiseExit(
    importD1IntoPostgres(makeSnapshot(), harness.config)
  )
  assert.equal(Exit.isFailure(exit), true)
  assert.deepEqual(await harness.counts(), {
    ...Object.fromEntries(registryTables.map(({ name }) => [name, 0])),
    registry_sequence: 1,
  })
})

test('rolls back every earlier table when a late constraint fails', async () => {
  const rows = new Map(makeSnapshot().rows)
  rows.set('generated_artifacts', [
    { ...fixtureRows.generated_artifacts[0], publication_version: -1 },
  ])
  const invalidSnapshot = makeSnapshot(rows, 'e'.repeat(64))

  const exit = await Effect.runPromiseExit(
    importD1IntoPostgres(invalidSnapshot, harness.config)
  )
  assert.equal(Exit.isFailure(exit), true)
  assert.deepEqual(
    await harness.counts(),
    Object.fromEntries(registryTables.map(({ name }) => [name, 0]))
  )
})
