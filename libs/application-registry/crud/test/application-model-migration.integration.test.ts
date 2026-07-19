import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { RegistryMiniflareHarness } from '@cv/worker-test-kit/application-registry'

const priorMigration = '20260717162534_useful_gressill'

let harness: RegistryMiniflareHarness

before(async () => {
  harness = await RegistryMiniflareHarness.make({
    databaseBinding: 'APPLICATION_REGISTRY_DB',
    throughMigration: priorMigration,
  })
})

after(async () => {
  await harness.dispose()
})

test('rebuilds the current model, removes legacy captures, and preserves current rows', async () => {
  await harness.database
    .prepare(
      `insert into applications (
        id, job_key, source, source_job_id, canonical_url, company,
        company_normalized, role, location, application_status, target_stage,
        personal_priority, fit_score, category, remote_policy, details,
        open_status, source_confidence, technology_stack, recommended_action,
        research_priority, follow_up_at, applied_at, last_contact_at,
        listing_availability, listing_confidence, listing_reason_code,
        listing_checked_at, listing_closed_candidate_at,
        listing_consecutive_closed_checks, version, updated_revision,
        created_at, updated_at
      ) values (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )`
    )
    .bind(
      'migration-application',
      'migration:application',
      'test',
      'source-1',
      'https://example.test/jobs/migration',
      'Migration Company',
      'migration company',
      'Platform Engineer',
      'Remote',
      'applied',
      'apply_next',
      'high',
      93,
      'Engineering',
      'Remote',
      '{"workMode":"remote"}',
      'Open',
      'High',
      'TypeScript',
      'Follow up',
      'High',
      '2026-07-21T09:00:00.000Z',
      '2026-07-18T09:00:00.000Z',
      '2026-07-19T09:00:00.000Z',
      'open',
      'high',
      'provider_open',
      '2026-07-20T09:00:00.000Z',
      null,
      0,
      7,
      42,
      '2026-07-17T09:00:00.000Z',
      '2026-07-20T09:00:00.000Z'
    )
    .run()
  await harness.database
    .prepare(
      'insert into application_labels (application_id, label, created_at) values (?, ?, ?)'
    )
    .bind('migration-application', 'priority', '2026-07-17T09:00:00.000Z')
    .run()
  await harness.database.batch([
    harness.database
      .prepare(
        `insert into application_notes
          (id, application_id, kind, body, source, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'migration-note',
        'migration-application',
        'general',
        'Preserve me',
        'test',
        '2026-07-17T09:00:00.000Z',
        '2026-07-17T09:00:00.000Z'
      ),
    harness.database
      .prepare(
        `insert into application_compensations
          (id, application_id, kind, currency_code, minimum_minor,
           maximum_minor, period, raw_text, source, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'migration-compensation',
        'migration-application',
        'base_salary',
        'USD',
        100_000,
        150_000,
        'year',
        null,
        'test',
        '2026-07-17T09:00:00.000Z',
        '2026-07-17T09:00:00.000Z'
      ),
    harness.database
      .prepare(
        `insert into application_identity_aliases
          (job_key, application_id, created_at) values (?, ?, ?)`
      )
      .bind(
        'migration:alias',
        'migration-application',
        '2026-07-17T09:00:00.000Z'
      ),
    harness.database
      .prepare(
        `insert into campaign_captures
          (id, application_id, campaign_run_id, profile, audience, confidence,
           application_url, fit_assessment, submission_details, artifacts,
           job_content_hash, captured_at, operation_id)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'migration-capture',
        'migration-application',
        'migration-run',
        'default',
        null,
        null,
        'https://example.test/jobs/migration/apply',
        null,
        '{}',
        '[]',
        null,
        '2026-07-17T09:00:00.000Z',
        'migration-capture-operation'
      ),
    harness.database
      .prepare(
        `insert into application_events
          (id, application_id, kind, revision, occurred_at, recorded_at,
           device_id, payload, operation_id)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'migration-event',
        'migration-application',
        'research_updated',
        43,
        '2026-07-17T09:00:00.000Z',
        '2026-07-17T09:00:00.000Z',
        null,
        '{}',
        'migration-event-operation'
      ),
    harness.database
      .prepare(
        `insert into command_receipts
          (operation_id, operation_request_signature, kind, application_id,
           event_id, capture_id, note_id, recorded_at)
         values (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'migration-receipt-operation',
        'migration-receipt-signature',
        'application_note',
        'migration-application',
        null,
        null,
        'migration-note',
        '2026-07-17T09:00:00.000Z'
      ),
    harness.database
      .prepare(
        `insert into application_listing_check_schedules
          (application_id, due_at, lease_token, lease_until, attempt_count,
           last_error, updated_at)
         values (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'migration-application',
        '2026-07-21T09:00:00.000Z',
        null,
        null,
        0,
        null,
        '2026-07-17T09:00:00.000Z'
      ),
    harness.database
      .prepare(
        `insert into application_listing_checks
          (id, application_id, run_id, operation_id, requested_url, final_url,
           provider, outcome, confidence, recommended_action, reason_code,
           http_status, evidence, content_hash, checker_version, checked_at,
           received_at, next_check_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'migration-listing-check',
        'migration-application',
        null,
        'migration-listing-operation',
        'https://example.test/jobs/migration',
        'https://example.test/jobs/migration',
        'example.test',
        'open',
        'high',
        'keep',
        'provider_open',
        200,
        '[]',
        null,
        'test',
        '2026-07-17T09:00:00.000Z',
        '2026-07-17T09:00:00.000Z',
        '2026-07-24T09:00:00.000Z'
      ),
    harness.database
      .prepare(
        `insert into content_entries
          (id, application_id, kind, locale, state, head_revision_id,
           approved_revision_id, version, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'migration-content-entry',
        'migration-application',
        'cv',
        'en',
        'draft',
        null,
        null,
        1,
        '2026-07-17T09:00:00.000Z',
        '2026-07-17T09:00:00.000Z'
      ),
    harness.database
      .prepare(
        `insert into job_posting_snapshots
          (id, application_id, requested_url, final_url, status, fetched_at,
           fetcher_version)
         values (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'migration-job-snapshot',
        'migration-application',
        'https://example.test/jobs/migration',
        'https://example.test/jobs/migration',
        'fetched',
        '2026-07-17T09:00:00.000Z',
        'test'
      ),
    harness.database
      .prepare(
        `insert into facts_releases
          (id, facts_schema_version, source_repository, source_commit,
           compiler_repository, compiler_commit, manifest_object_key,
           manifest_sha256, manifest_byte_length, created_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'migration-facts-release',
        'cv.facts.v1',
        'cv-content',
        'source-commit',
        'cv',
        'compiler-commit',
        'sha256/migration-facts-manifest',
        'migration-facts-manifest',
        128,
        '2026-07-17T09:00:00.000Z'
      ),
    harness.database
      .prepare(
        `insert into content_revisions
          (id, content_entry_id, revision_number, parent_revision_id,
           contract_id, contract_version, object_key, sha256, byte_length,
           media_type, source, facts_release_id, job_snapshot_id,
           operation_id, created_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'migration-content-revision',
        'migration-content-entry',
        1,
        null,
        'cv.document',
        '1',
        'sha256/migration-content',
        'migration-content',
        256,
        'application/json',
        'human',
        'migration-facts-release',
        'migration-job-snapshot',
        'migration-content-operation',
        '2026-07-17T09:00:00.000Z'
      ),
    harness.database
      .prepare(
        `insert into cv_links
          (id, application_id, content_entry_id, published_revision_id,
           token, public_url, enabled, version, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'migration-cv-link',
        'migration-application',
        'migration-content-entry',
        'migration-content-revision',
        'migration-public-token',
        'https://cv.example.test/c/migration-public-token',
        1,
        1,
        '2026-07-17T09:00:00.000Z',
        '2026-07-17T09:00:00.000Z'
      ),
    harness.database
      .prepare(
        `insert into generated_artifacts
          (id, cv_link_id, content_revision_id, kind, status, workflow_id,
           renderer_version, qr_target, created_at, updated_at)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'migration-pdf-artifact',
        'migration-cv-link',
        'migration-content-revision',
        'pdf',
        'pending',
        'migration-pdf-workflow',
        'renderer-v1',
        'https://cv.example.test/c/migration-public-token',
        '2026-07-17T09:00:00.000Z',
        '2026-07-17T09:00:00.000Z'
      ),
  ])

  await harness.database.batch([
    harness.database
      .prepare(
        `insert into application_events
          (id, application_id, kind, revision, occurred_at, recorded_at,
           device_id, payload, operation_id)
         values (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'legacy-campaign-event',
        'migration-application',
        'campaign_prepared',
        44,
        '2026-07-17T09:01:00.000Z',
        '2026-07-17T09:01:00.000Z',
        null,
        '{}',
        'legacy-campaign-event-operation'
      ),
    harness.database
      .prepare(
        `insert into command_receipts
          (operation_id, operation_request_signature, kind, application_id,
           event_id, capture_id, note_id, recorded_at)
         values (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'legacy-campaign-receipt',
        'legacy-campaign-signature',
        'campaign_capture',
        'migration-application',
        null,
        'migration-capture',
        null,
        '2026-07-17T09:01:00.000Z'
      ),
  ])

  await harness.migrateAfter(priorMigration)

  const rows = await harness.query<{
    readonly application_status: string
    readonly company: string
    readonly follow_up_at: string
    readonly id: string
    readonly listing_availability: string
    readonly updated_revision: number
    readonly version: number
  }>('select * from applications')
  assert.equal(rows.length, 1)
  assert.partialDeepStrictEqual(rows[0], {
    application_status: 'applied',
    company: 'Migration Company',
    follow_up_at: '2026-07-21T09:00:00.000Z',
    id: 'migration-application',
    listing_availability: 'open',
    updated_revision: 42,
    version: 7,
  })

  const columns = await harness.query<{ readonly name: string }>(
    'pragma table_info(applications)'
  )
  const columnNames = new Set(columns.map(({ name }) => name))
  for (const removed of [
    'category',
    'details',
    'fit_score',
    'open_status',
    'recommended_action',
    'remote_policy',
    'research_priority',
    'source_confidence',
    'technology_stack',
  ]) {
    assert.equal(columnNames.has(removed), false)
  }

  const preservedTables = [
    'application_labels',
    'application_notes',
    'application_compensations',
    'application_identity_aliases',
    'application_events',
    'command_receipts',
    'application_listing_check_schedules',
    'application_listing_checks',
    'content_entries',
    'content_revisions',
    'cv_links',
    'generated_artifacts',
    'facts_releases',
    'job_posting_snapshots',
  ] as const
  for (const table of preservedTables) {
    assert.deepEqual(
      await harness.query(`select count(*) as count from ${table}`),
      [{ count: 1 }]
    )
  }
  const tables = await harness.query<{ readonly name: string }>(
    "select name from sqlite_master where type = 'table'"
  )
  assert.equal(
    tables.some(({ name }) => name === 'campaign_captures'),
    false
  )
  const receiptColumns = await harness.query<{ readonly name: string }>(
    'pragma table_info(command_receipts)'
  )
  assert.equal(
    receiptColumns.some(({ name }) => name === 'capture_id'),
    false
  )
  assert.deepEqual(
    await harness.query(
      'select kind from application_events order by revision'
    ),
    [{ kind: 'research_updated' }]
  )
  assert.deepEqual(
    await harness.query(
      'select kind from command_receipts order by operation_id'
    ),
    [{ kind: 'application_note' }]
  )
  assert.deepEqual(await harness.query('pragma foreign_key_check'), [])

  await assert.rejects(
    harness.database
      .prepare(
        `insert into application_events
          (id, application_id, kind, revision, occurred_at, recorded_at,
           payload, operation_id)
         values (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'rejected-legacy-event',
        'migration-application',
        'campaign_prepared',
        100,
        '2026-07-20T00:00:00.000Z',
        '2026-07-20T00:00:00.000Z',
        '{}',
        'rejected-legacy-event-operation'
      )
      .run()
  )
  await assert.rejects(
    harness.database
      .prepare(
        `insert into command_receipts
          (operation_id, operation_request_signature, kind, application_id,
           recorded_at)
         values (?, ?, ?, ?, ?)`
      )
      .bind(
        'rejected-legacy-receipt',
        'rejected-legacy-signature',
        'campaign_capture',
        'migration-application',
        '2026-07-20T00:00:00.000Z'
      )
      .run()
  )

  const indexes = await harness.query<{ readonly name: string }>(
    'pragma index_list(applications)'
  )
  const indexNames = new Set(indexes.map(({ name }) => name))
  assert.equal(indexNames.has('applications_job_key_unique'), true)
  assert.equal(indexNames.has('applications_updated_revision_unique'), true)

  await assert.rejects(
    harness.database
      .prepare(
        `insert into applications (
          id, job_key, source, canonical_url, company, company_normalized,
          role, application_status, target_stage, updated_revision,
          created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'invalid-status',
        'migration:invalid-status',
        'test',
        'https://example.test/jobs/invalid',
        'Invalid Company',
        'invalid company',
        'Engineer',
        'not-a-status',
        'backlog',
        43,
        '2026-07-20T09:00:00.000Z',
        '2026-07-20T09:00:00.000Z'
      )
      .run()
  )
})
