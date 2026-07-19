import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { RegistryMiniflareHarness } from '@cv/worker-test-kit/application-registry'

const priorMigration = '20260717184759_gorgeous_franklin_richards'
const recordedAt = '2026-07-17T19:00:00.000Z'

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

test('migrates historical artifacts into publication-scoped retry attempts', async () => {
  await harness.database.batch([
    harness.database
      .prepare(
        `insert into applications (
          id, job_key, source, canonical_url, company, company_normalized,
          role, updated_revision, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'artifact-migration-application',
        'migration:artifact',
        'test',
        'https://example.test/jobs/artifact',
        'Artifact Company',
        'artifact company',
        'Platform Engineer',
        900,
        recordedAt,
        recordedAt
      ),
    harness.database
      .prepare(
        `insert into content_entries (
          id, application_id, kind, locale, state, head_revision_id,
          approved_revision_id, version, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        'artifact-migration-entry',
        'artifact-migration-application',
        'cv',
        'en',
        'approved',
        'artifact-migration-revision',
        'artifact-migration-revision',
        3,
        recordedAt,
        recordedAt
      ),
  ])
  await harness.database
    .prepare(
      `insert into content_revisions (
        id, content_entry_id, revision_number, parent_revision_id,
        contract_id, contract_version, object_key, sha256, byte_length,
        media_type, source, facts_release_id, job_snapshot_id, operation_id,
        created_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      'artifact-migration-revision',
      'artifact-migration-entry',
      1,
      null,
      'cv.document.v1',
      '1',
      'sha256/artifact-migration-revision',
      'artifact-migration-revision',
      256,
      'application/json',
      'human',
      null,
      null,
      'artifact-migration-operation',
      recordedAt
    )
    .run()
  await harness.database
    .prepare(
      `insert into cv_links (
        id, application_id, content_entry_id, published_revision_id, token,
        public_url, enabled, version, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      'artifact-migration-link',
      'artifact-migration-application',
      'artifact-migration-entry',
      'artifact-migration-revision',
      'artifact-migration-token',
      'https://cv.example.test/c/artifact-migration-token',
      true,
      7,
      recordedAt,
      recordedAt
    )
    .run()
  await harness.database
    .prepare(
      `insert into generated_artifacts (
        id, cv_link_id, content_revision_id, kind, status, workflow_id,
        renderer_version, qr_target, object_key, sha256, byte_length,
        media_type, generated_at, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      'artifact-migration-artifact',
      'artifact-migration-link',
      'artifact-migration-revision',
      'pdf',
      'ready',
      null,
      'renderer-v1',
      'https://cv.example.test/c/artifact-migration-token',
      'sha256/artifact-migration-pdf',
      'artifact-migration-pdf',
      1024,
      'application/pdf',
      recordedAt,
      recordedAt,
      recordedAt
    )
    .run()

  await harness.migrateAfter(priorMigration)

  const artifacts = await harness.query<{
    readonly id: string
    readonly publication_version: number
    readonly request_id: string
  }>('select id, publication_version, request_id from generated_artifacts')
  assert.deepEqual(artifacts, [
    {
      id: 'artifact-migration-artifact',
      publication_version: 7,
      request_id: 'legacy:artifact-migration-artifact:missing',
    },
  ])
  const links = await harness.query<{
    readonly id: string
    readonly publication_version: number
    readonly version: number
  }>('select id, publication_version, version from cv_links')
  assert.deepEqual(links, [
    {
      id: 'artifact-migration-link',
      publication_version: 7,
      version: 7,
    },
  ])

  const indexes = await harness.query<{
    readonly name: string
    readonly unique: number
  }>('pragma index_list(generated_artifacts)')
  assert.equal(
    indexes.some(
      (index) =>
        index.name === 'generated_artifacts_request_unique' &&
        index.unique === 1
    ),
    true
  )

  const foreignKeys = await harness.query<{
    readonly from: string
    readonly on_delete: string
  }>('pragma foreign_key_list(generated_artifacts)')
  assert.equal(
    foreignKeys
      .filter(({ from }) =>
        ['content_revision_id', 'cv_link_id'].includes(from)
      )
      .every(({ on_delete }) => on_delete === 'CASCADE'),
    true
  )
})
