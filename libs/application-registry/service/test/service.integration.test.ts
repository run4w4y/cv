import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { RegistryMiniflareHarness } from '@cv/application-registry-crud/test-support'
import { Schema } from 'effect'

let harness: RegistryMiniflareHarness

beforeEach(async () => {
  harness = await RegistryMiniflareHarness.make({
    databaseBinding: 'APPLICATION_REGISTRY_DB',
    workerBundlePath: fileURLToPath(
      new URL('./dist/worker.js', import.meta.url)
    ),
    workerName: 'application-registry-service-test',
  })
})

afterEach(async () => {
  await harness.dispose()
})

test('runs application defaults, patches, labels, and checkpoints over D1', async () => {
  const result = await harness.fetchJson(
    Schema.Struct({
      checkpoint: Schema.NullOr(Schema.String),
      created: Schema.Struct({
        applicationStatus: Schema.String,
        id: Schema.String,
        version: Schema.Number,
      }),
      deltaIds: Schema.Array(Schema.String),
      labels: Schema.Array(Schema.String),
      patched: Schema.Struct({
        fitScore: Schema.NullOr(Schema.Number),
        recommendedAction: Schema.NullOr(Schema.String),
        version: Schema.Number,
      }),
      storedLabels: Schema.Array(Schema.String),
    }),
    '/workflows/application'
  )

  assert.equal(result.created.applicationStatus, 'not_started')
  assert.equal(result.created.version, 1)
  assert.ok(result.checkpoint)
  assert.deepEqual(result.deltaIds, [result.created.id])
  assert.deepEqual(result.labels, ['priority', 'remote'])
  assert.deepEqual(result.storedLabels, result.labels)
  assert.equal(result.patched.fitScore, 91)
  assert.equal(result.patched.recommendedAction, 'Apply this week')
  assert.equal(result.patched.version, 2)
})

test('persists an explicit status transition and replays its event command', async () => {
  const result = await harness.fetchJson(
    Schema.Struct({
      applicationStatus: Schema.String,
      applicationVersion: Schema.Number,
      conflictTag: Schema.NullOr(Schema.String),
      eventIdsMatch: Schema.Boolean,
      firstReplayed: Schema.Boolean,
      replayed: Schema.Boolean,
      storedEventOperationIds: Schema.Array(Schema.String),
    }),
    '/workflows/event'
  )

  assert.equal(result.applicationStatus, 'technical_screen')
  assert.equal(result.applicationVersion, 2)
  assert.equal(result.firstReplayed, false)
  assert.equal(result.replayed, true)
  assert.equal(result.eventIdsMatch, true)
  assert.equal(result.conflictTag, 'RegistryConflictError')
  assert.deepEqual(result.storedEventOperationIds, ['service:event:1'])

  const receipts = await harness.query(
    Schema.Struct({ operationId: Schema.String }),
    `select operation_id as operationId
       from command_receipts
      where operation_id = ?1`,
    ['service:event:1']
  )
  assert.deepEqual(receipts, [{ operationId: 'service:event:1' }])
})

test('replays note and capture commands and rejects operation conflicts', async () => {
  const result = await harness.fetchJson(
    Schema.Struct({
      captureIdsMatch: Schema.Boolean,
      captureReplayed: Schema.Boolean,
      noteConflictTag: Schema.NullOr(Schema.String),
      noteIdsMatch: Schema.Boolean,
      noteReplayed: Schema.Boolean,
      replayedCapture: Schema.Boolean,
      replayedNote: Schema.Boolean,
      storedCaptureCount: Schema.Number,
      storedNoteCount: Schema.Number,
    }),
    '/workflows/note-and-capture'
  )

  assert.equal(result.noteReplayed, false)
  assert.equal(result.replayedNote, true)
  assert.equal(result.noteIdsMatch, true)
  assert.equal(result.noteConflictTag, 'RegistryConflictError')
  assert.equal(result.captureReplayed, false)
  assert.equal(result.replayedCapture, true)
  assert.equal(result.captureIdsMatch, true)
  assert.equal(result.storedNoteCount, 1)
  assert.equal(result.storedCaptureCount, 1)

  const receipts = await harness.query(
    Schema.Struct({ count: Schema.Number }),
    `select count(*) as count
       from command_receipts
      where operation_id in (?1, ?2)`,
    ['service:note:1', 'service:capture:1']
  )
  assert.deepEqual(receipts, [{ count: 2 }])
})

test('converts stored compensation through an injected FX service', async () => {
  const result = await harness.fetchJson(
    Schema.Struct({
      conversion: Schema.NullOr(
        Schema.Struct({
          currencyCode: Schema.String,
          maximumMinor: Schema.NullOr(Schema.Number),
          minimumMinor: Schema.NullOr(Schema.Number),
          observedAt: Schema.String,
          provider: Schema.String,
          rate: Schema.Number,
        })
      ),
      originalCurrency: Schema.NullOr(Schema.String),
    }),
    '/workflows/compensation'
  )

  assert.equal(result.originalCurrency, 'EUR')
  assert.deepEqual(result.conversion, {
    currencyCode: 'USD',
    maximumMinor: 24_000_000,
    minimumMinor: 20_000_000,
    observedAt: '2026-07-12T12:00:00.000Z',
    provider: 'service-integration',
    rate: 2,
  })
})

test('resolves concurrent identical note operations to one write and one replay', async () => {
  const result = await harness.fetchJson(
    Schema.Struct({
      applicationId: Schema.String,
      noteIds: Schema.Array(Schema.String),
      replayed: Schema.Array(Schema.Boolean),
      storedNoteCount: Schema.Number,
      storedNoteEventCount: Schema.Number,
    }),
    '/workflows/concurrent-note'
  )

  assert.deepEqual([...result.replayed].sort(), [false, true])
  assert.equal(result.noteIds[0], result.noteIds[1])
  assert.equal(result.storedNoteCount, 1)
  assert.equal(result.storedNoteEventCount, 1)

  const receipts = await harness.query(
    Schema.Struct({ count: Schema.Number }),
    `select count(*) as count
       from command_receipts
      where operation_id = ?1`,
    ['service:concurrent-note']
  )
  assert.deepEqual(receipts, [{ count: 1 }])
})

test('converges concurrent captures on one job and replays each operation', async () => {
  const result = await harness.fetchJson(
    Schema.Struct({
      applicationIds: Schema.Array(Schema.String),
      captureIds: Schema.Array(Schema.String),
      firstReplayed: Schema.Boolean,
      replayCaptureId: Schema.String,
      replayed: Schema.Boolean,
      secondReplayed: Schema.Boolean,
      storedCaptureCount: Schema.Number,
    }),
    '/workflows/concurrent-captures'
  )

  assert.equal(result.firstReplayed, false)
  assert.equal(result.secondReplayed, false)
  assert.equal(result.applicationIds[0], result.applicationIds[1])
  assert.notEqual(result.captureIds[0], result.captureIds[1])
  assert.equal(result.replayed, true)
  assert.equal(result.replayCaptureId, result.captureIds[0])
  assert.equal(result.storedCaptureCount, 2)

  const applications = await harness.query(
    Schema.Struct({ count: Schema.Number }),
    'select count(*) as count from applications where job_key = ?1',
    ['service:concurrent-capture']
  )
  const receipts = await harness.query(
    Schema.Struct({ operationId: Schema.String }),
    `select operation_id as operationId
       from command_receipts
      where operation_id like 'service:capture-race:%'
      order by operation_id`
  )
  assert.deepEqual(applications, [{ count: 1 }])
  assert.deepEqual(receipts, [
    { operationId: 'service:capture-race:a' },
    { operationId: 'service:capture-race:b' },
  ])
})

test('keeps child replacements consistent with the concurrent job-key winner', async () => {
  const results = await harness.fetchJson(
    Schema.Array(
      Schema.Struct({
        childStateMatchesWinner: Schema.Boolean,
        responseApplicationIds: Schema.Array(Schema.String),
        storedApplicationId: Schema.String,
      })
    ),
    '/workflows/concurrent-upserts'
  )

  assert.equal(results.length, 6)
  for (const result of results) {
    assert.equal(result.childStateMatchesWinner, true)
    assert.deepEqual(result.responseApplicationIds, [
      result.storedApplicationId,
      result.storedApplicationId,
    ])
  }

  const applications = await harness.query(
    Schema.Struct({ count: Schema.Number }),
    `select count(*) as count
       from applications
      where job_key like 'service:concurrent-upsert-%'`
  )
  assert.deepEqual(applications, [{ count: 6 }])
})

test('merges non-destructive captures while explicit upserts still replace fields', async () => {
  const result = await harness.fetchJson(
    Schema.Struct({
      backlogId: Schema.String,
      captured: Schema.Struct({
        id: Schema.String,
        location: Schema.NullOr(Schema.String),
        sourceJobId: Schema.NullOr(Schema.String),
        targetStage: Schema.String,
      }),
      existingId: Schema.String,
      explicitlyReplaced: Schema.Struct({
        location: Schema.NullOr(Schema.String),
        sourceJobId: Schema.NullOr(Schema.String),
        targetStage: Schema.String,
      }),
      promoted: Schema.Struct({
        id: Schema.String,
        targetStage: Schema.String,
      }),
    }),
    '/workflows/capture-merge'
  )

  assert.equal(result.captured.id, result.existingId)
  assert.equal(result.captured.location, 'Existing enriched location')
  assert.equal(result.captured.sourceJobId, 'existing-source-job-id')
  assert.equal(result.captured.targetStage, 'verify_first')
  assert.equal(result.promoted.id, result.backlogId)
  assert.equal(result.promoted.targetStage, 'apply_next')
  assert.deepEqual(result.explicitlyReplaced, {
    location: null,
    sourceJobId: null,
    targetStage: 'secondary',
  })
})

test('uses database defaults for applications and capture-created applications', async () => {
  const result = await harness.fetchJson(
    Schema.Struct({
      captureStatus: Schema.String,
      created: Schema.Struct({
        applicationStatus: Schema.String,
        category: Schema.NullOr(Schema.String),
        fitScore: Schema.NullOr(Schema.Number),
        targetStage: Schema.String,
        version: Schema.Number,
      }),
    }),
    '/workflows/defaults'
  )

  assert.deepEqual(result.created, {
    applicationStatus: 'not_started',
    category: null,
    fitScore: null,
    targetStage: 'backlog',
    version: 1,
  })
  assert.equal(result.captureStatus, 'preparing')
})

test('preserves omitted patch fields and clears explicit nulls', async () => {
  const result = await harness.fetchJson(
    Schema.Struct({
      cleared: Schema.Struct({
        category: Schema.NullOr(Schema.String),
        details: Schema.NullOr(Schema.Unknown),
        fitScore: Schema.NullOr(Schema.Number),
        followUpAt: Schema.NullOr(Schema.String),
        personalPriority: Schema.NullOr(Schema.String),
      }),
      partiallyUpdated: Schema.Struct({
        category: Schema.NullOr(Schema.String),
        details: Schema.NullOr(Schema.Unknown),
        fitScore: Schema.NullOr(Schema.Number),
        followUpAt: Schema.NullOr(Schema.String),
        personalPriority: Schema.NullOr(Schema.String),
      }),
    }),
    '/workflows/patch-nullability'
  )

  assert.equal(result.partiallyUpdated.fitScore, 42)
  assert.equal(result.partiallyUpdated.category, 'Backend')
  assert.equal(result.partiallyUpdated.followUpAt, '2026-07-20T12:00:00.000Z')
  assert.equal(result.partiallyUpdated.personalPriority, 'high')
  assert.deepEqual(result.partiallyUpdated.details, {
    applyFromAbroad: 'Yes',
    countryCode: 'JP',
    employmentType: 'full-time',
    languageRequirements: ['English'],
    region: 'Kanto',
    relocationSupport: 'Available',
    remoteRegion: 'Worldwide',
    residenceRequirement: null,
    timezoneOverlap: 'JST overlap',
    visaSponsorship: 'Case by case',
    workAuthorization: 'Not required when applying',
    workMode: 'remote',
  })
  assert.deepEqual(result.cleared, {
    category: null,
    details: null,
    fitScore: 42,
    followUpAt: null,
    personalPriority: null,
  })
})

test('allows exactly one winner in a concurrent optimistic-version race', async () => {
  const result = await harness.fetchJson(
    Schema.Struct({
      currentStatus: Schema.String,
      currentVersion: Schema.Number,
      failureTags: Schema.Array(Schema.String),
      initialVersion: Schema.Number,
      successCount: Schema.Number,
    }),
    '/workflows/optimistic-patch-race'
  )

  assert.equal(result.successCount, 1)
  assert.deepEqual(result.failureTags, ['RegistryConflictError'])
  assert.equal(result.currentVersion, result.initialVersion + 1)
  assert.ok(
    result.currentStatus === 'applied' || result.currentStatus === 'rejected'
  )
})

test('commits one explicit lifecycle transition and replays its winner', async () => {
  const result = await harness.fetchJson(
    Schema.Struct({
      currentStatus: Schema.String,
      currentVersion: Schema.Number,
      failureTags: Schema.Array(Schema.String),
      initialVersion: Schema.Number,
      replayed: Schema.Boolean,
      storedOperationIds: Schema.Array(Schema.String),
      successCount: Schema.Number,
      winningOperationId: Schema.String,
    }),
    '/workflows/lifecycle-race'
  )

  assert.equal(result.successCount, 1)
  assert.deepEqual(result.failureTags, ['RegistryConflictError'])
  assert.equal(result.currentVersion, result.initialVersion + 1)
  assert.ok(
    result.currentStatus === 'applied' || result.currentStatus === 'rejected'
  )
  assert.equal(result.replayed, true)
  assert.deepEqual(result.storedOperationIds, [result.winningOperationId])
})

test('rolls back every write when an atomic operation receipt cannot commit', async () => {
  const result = await harness.fetchJson(
    Schema.Struct({
      afterRevision: Schema.NullOr(Schema.Number),
      beforeRevision: Schema.Number,
      eventCount: Schema.Number,
      failureTag: Schema.NullOr(Schema.String),
      noteCount: Schema.Number,
      receiptCount: Schema.Number,
    }),
    '/workflows/rollback'
  )

  assert.equal(result.failureTag, 'RegistryDatabaseError')
  assert.equal(result.noteCount, 0)
  assert.equal(result.receiptCount, 0)
  assert.equal(result.eventCount, 0)
  assert.equal(result.afterRevision, result.beforeRevision)
})
