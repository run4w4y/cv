import { Database } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Effect } from 'effect'

import { migrationError, migrationFailure } from './errors'
import { registryTables, type TableSpec } from './manifest'
import {
  type NormalizedRegistry,
  normalizeRow,
  type RegistryRow,
} from './transform'

export interface D1SourceSnapshot {
  readonly diagnostics: D1SourceDiagnostics
  readonly migrations: readonly string[]
  readonly rows: NormalizedRegistry
  readonly sha256: string
}

export interface D1SourceDiagnostics {
  readonly retiredTableRows: Readonly<{
    fx_rates: number
    pdf_generation_outbox: number
  }>
  readonly runningListingCheckRuns: number
}

/** Exact migration history deployed to the live D1 database. */
export const supportedD1MigrationHistory = [
  { id: 1, name: '20260712092818_registry_initial/migration.sql' },
  { id: 2, name: '20260712180313_keen_firelord/migration.sql' },
  { id: 3, name: '20260713083740_greedy_boomerang/migration.sql' },
  { id: 4, name: '20260714072611_tiresome_the_santerians/migration.sql' },
  { id: 5, name: '20260715045550_public_stone_men/migration.sql' },
  { id: 6, name: '20260717054638_white_falcon/migration.sql' },
  { id: 7, name: '20260717135340_mighty_genesis/migration.sql' },
  { id: 8, name: '20260717162534_useful_gressill/migration.sql' },
  { id: 9, name: '20260717184759_gorgeous_franklin_richards/migration.sql' },
  { id: 10, name: '20260717194541_handy_micromacro/migration.sql' },
  { id: 11, name: '20260717200436_nosy_leader/migration.sql' },
  { id: 12, name: '20260719014938_aromatic_ma_gnuci/migration.sql' },
  { id: 13, name: '20260719031352_sharp_wraith/migration.sql' },
  { id: 14, name: '20260719042902_marvelous_madrox/migration.sql' },
  { id: 15, name: '20260719114916_dapper_colonel_america/migration.sql' },
] as const

/**
 * Complete non-SQLite-internal source inventory. Retired tables are
 * deliberately retained here so discarding them is explicit and observable
 * rather than silent.
 */
export const supportedD1TableInventory = [
  ...registryTables.map(({ name }) => name),
  'd1_migrations',
  'fx_rates',
  'pdf_generation_outbox',
].toSorted()

const quoteIdentifier = (value: string): string =>
  `"${value.replaceAll('"', '""')}"`

const expectedSha256Pattern = /^[a-f0-9]{64}$/u

const readExport = (path: string, expectedSha256: string) =>
  Effect.try({
    try: () => {
      if (!expectedSha256Pattern.test(expectedSha256)) {
        throw new Error(
          'Expected SHA-256 must be 64 lowercase hexadecimal characters.'
        )
      }
      const bytes = readFileSync(path)
      const actualSha256 = createHash('sha256').update(bytes).digest('hex')
      if (actualSha256 !== expectedSha256) {
        throw new Error(
          `D1 export SHA-256 mismatch: expected ${expectedSha256}, received ${actualSha256}.`
        )
      }
      return { actualSha256, sql: bytes.toString('utf8') }
    },
    catch: migrationError(
      'read D1 export',
      `Could not read D1 export ${path}.`
    ),
  })

const openExport = (sql: string) =>
  Effect.acquireRelease(
    Effect.try({
      try: () => {
        const database = new Database(':memory:', { strict: true })
        database.exec(sql)
        return database
      },
      catch: migrationError(
        'open D1 export',
        'Could not reconstruct the D1 export in SQLite.'
      ),
    }),
    (database) => Effect.sync(() => database.close())
  )

const validateSQLite = (database: Database) =>
  Effect.try({
    try: () => {
      const quickCheck = database
        .query<Record<string, string>, []>('PRAGMA quick_check')
        .all()
      if (
        quickCheck.length !== 1 ||
        Object.values(quickCheck[0] ?? {}).at(0) !== 'ok'
      ) {
        throw new Error(
          `SQLite quick_check failed: ${JSON.stringify(quickCheck)}`
        )
      }

      const foreignKeyFailures = database
        .query<Record<string, unknown>, []>('PRAGMA foreign_key_check')
        .all()
      if (foreignKeyFailures.length > 0) {
        throw new Error(
          `D1 foreign-key check failed: ${JSON.stringify(foreignKeyFailures)}`
        )
      }
    },
    catch: migrationError(
      'validate D1 export',
      'The D1 export failed SQLite integrity validation.'
    ),
  })

export const validateD1MigrationHistory = (
  migrations: readonly { readonly id: number; readonly name: string }[]
) =>
  Effect.try({
    try: () => {
      const mismatch =
        migrations.length !== supportedD1MigrationHistory.length ||
        migrations.some(({ id, name }, index) => {
          const expected = supportedD1MigrationHistory[index]
          return (
            expected === undefined ||
            id !== expected.id ||
            name !== expected.name
          )
        })
      if (mismatch) {
        throw new Error(
          `Expected the exact ${supportedD1MigrationHistory.length}-migration live D1 history, received ${JSON.stringify(migrations)}.`
        )
      }
      return migrations.map(({ id, name }) => `${id}:${name}`)
    },
    catch: migrationError(
      'read D1 migration history',
      'The export does not contain the supported final D1 migration history.'
    ),
  })

const readMigrationHistory = (database: Database) =>
  Effect.try({
    try: () =>
      database
        .query<{ id: number; name: string }, []>(
          'select id, name from d1_migrations order by id'
        )
        .all(),
    catch: migrationError(
      'read D1 migration history',
      'The export does not contain a readable D1 migration history.'
    ),
  }).pipe(Effect.flatMap(validateD1MigrationHistory))

export const validateD1TableInventory = (tables: readonly string[]) =>
  Effect.try({
    try: () => {
      const actual = [...tables].toSorted()
      const missing = supportedD1TableInventory.filter(
        (table) => !actual.includes(table)
      )
      const unexpected = actual.filter(
        (table) => !supportedD1TableInventory.includes(table)
      )
      if (
        actual.length !== supportedD1TableInventory.length ||
        missing.length > 0 ||
        unexpected.length > 0
      ) {
        throw new Error(
          `D1 table inventory mismatch; missing [${missing.join(', ')}], unexpected [${unexpected.join(', ')}].`
        )
      }
      return actual
    },
    catch: migrationError(
      'validate D1 table inventory',
      'The export does not contain the exact supported D1 table inventory.'
    ),
  })

const readTableInventory = (database: Database) =>
  Effect.try({
    try: () =>
      database
        .query<{ name: string }, []>(
          "select name from sqlite_master where type = 'table' order by name"
        )
        .all()
        .map(({ name }) => name)
        .filter((name) => !name.startsWith('sqlite_')),
    catch: migrationError(
      'read D1 table inventory',
      'Could not inventory the D1 export tables.'
    ),
  }).pipe(Effect.flatMap(validateD1TableInventory))

const readSourceDiagnostics = (
  database: Database
): Effect.Effect<D1SourceDiagnostics, unknown> =>
  Effect.try({
    try: () => {
      const fxRates = database
        .query<{ count: number }, []>('select count(*) as count from fx_rates')
        .get()?.count
      const pdfGenerationOutbox = database
        .query<{ count: number }, []>(
          'select count(*) as count from pdf_generation_outbox'
        )
        .get()?.count
      const runningListingCheckRuns = database
        .query<{ count: number }, []>(
          "select count(*) as count from listing_check_runs where state = 'running'"
        )
        .get()?.count
      if (
        typeof fxRates !== 'number' ||
        typeof pdfGenerationOutbox !== 'number' ||
        typeof runningListingCheckRuns !== 'number'
      ) {
        throw new Error('D1 diagnostic counts were not numeric.')
      }
      return {
        retiredTableRows: {
          fx_rates: fxRates,
          pdf_generation_outbox: pdfGenerationOutbox,
        },
        runningListingCheckRuns,
      }
    },
    catch: migrationError(
      'read D1 diagnostics',
      'Could not read retired-table and running-run diagnostics from D1.'
    ),
  })

export const validateD1ColumnInventory = (
  spec: TableSpec,
  columns: readonly string[]
) =>
  Effect.try({
    try: () => {
      const d1DefaultColumns = new Set(Object.keys(spec.d1Defaults ?? {}))
      const sourceColumns = spec.columns.filter(
        (column) => !d1DefaultColumns.has(column)
      )
      const available = new Set(columns)
      const missing = sourceColumns.filter((column) => !available.has(column))
      const expected = new Set(sourceColumns)
      const unexpected = columns.filter((column) => !expected.has(column))
      if (missing.length > 0 || unexpected.length > 0) {
        throw new Error(
          `${spec.name} column inventory mismatch; missing [${missing.join(', ')}], unexpected [${unexpected.join(', ')}].`
        )
      }
    },
    catch: migrationError(
      'validate D1 table',
      `D1 table ${spec.name} does not match the final source shape.`
    ),
  })

const validateColumns = (database: Database, spec: TableSpec) =>
  Effect.try({
    try: () =>
      database
        .query<{ name: string }, []>(
          `PRAGMA table_info(${quoteIdentifier(spec.name)})`
        )
        .all()
        .map(({ name }) => name),
    catch: migrationError(
      'inspect D1 table',
      `Could not inspect the D1 table ${spec.name}.`
    ),
  }).pipe(Effect.flatMap((columns) => validateD1ColumnInventory(spec, columns)))

const readTable = (database: Database, spec: TableSpec) =>
  validateColumns(database, spec).pipe(
    Effect.flatMap(() =>
      Effect.try({
        try: () => {
          const d1DefaultColumns = new Set(Object.keys(spec.d1Defaults ?? {}))
          const columns = spec.columns
            .filter((column) => !d1DefaultColumns.has(column))
            .map(quoteIdentifier)
            .join(', ')
          return database
            .query<RegistryRow, []>(
              `select ${columns} from ${quoteIdentifier(spec.name)}`
            )
            .all()
        },
        catch: migrationError(
          'read D1 table',
          `Could not read D1 table ${spec.name}.`
        ),
      })
    ),
    Effect.flatMap((rows) =>
      Effect.forEach(rows, (row) =>
        normalizeRow(spec, { ...spec.d1Defaults, ...row }, 'd1')
      )
    )
  )

const requiredString = (
  row: RegistryRow,
  column: string,
  relation: string
): string => {
  const value = row[column]
  if (typeof value !== 'string') {
    throw migrationFailure(
      'validate D1 relationships',
      `${relation}.${column} is not a string identifier.`
    )
  }
  return value
}

const optionalString = (
  row: RegistryRow,
  column: string,
  relation: string
): string | null => {
  const value = row[column]
  if (value === null) return null
  return requiredString(row, column, relation)
}

const rowsFor = (rows: NormalizedRegistry, table: string) =>
  rows.get(table) ?? []

const validateUnconstrainedRelationships = (rows: NormalizedRegistry) =>
  Effect.try({
    try: () => {
      const revisions = new Map(
        rowsFor(rows, 'content_revisions').map((row) => [
          requiredString(row, 'id', 'content_revisions'),
          row,
        ])
      )
      const entries = new Map(
        rowsFor(rows, 'content_entries').map((row) => [
          requiredString(row, 'id', 'content_entries'),
          row,
        ])
      )
      const links = new Map(
        rowsFor(rows, 'cv_links').map((row) => [
          requiredString(row, 'id', 'cv_links'),
          row,
        ])
      )

      for (const entry of entries.values()) {
        const entryId = requiredString(entry, 'id', 'content_entries')
        for (const column of ['head_revision_id', 'approved_revision_id']) {
          const revisionId = optionalString(entry, column, 'content_entries')
          if (revisionId === null) continue
          const revision = revisions.get(revisionId)
          if (
            revision === undefined ||
            requiredString(
              revision,
              'content_entry_id',
              'content_revisions'
            ) !== entryId
          ) {
            throw new Error(
              `${column} does not belong to content entry ${entryId}.`
            )
          }
        }
      }

      for (const revision of revisions.values()) {
        const parentId = optionalString(
          revision,
          'parent_revision_id',
          'content_revisions'
        )
        if (parentId === null) continue
        const parent = revisions.get(parentId)
        if (
          parent === undefined ||
          requiredString(parent, 'content_entry_id', 'content_revisions') !==
            requiredString(revision, 'content_entry_id', 'content_revisions')
        ) {
          throw new Error(`Content revision ${parentId} is not a valid parent.`)
        }
      }

      for (const link of links.values()) {
        const revision = revisions.get(
          requiredString(link, 'current_revision_id', 'cv_links')
        )
        const entryId = requiredString(link, 'content_entry_id', 'cv_links')
        const entry = entries.get(entryId)
        if (
          revision === undefined ||
          entry === undefined ||
          requiredString(revision, 'content_entry_id', 'content_revisions') !==
            entryId ||
          requiredString(entry, 'application_id', 'content_entries') !==
            requiredString(link, 'application_id', 'cv_links')
        ) {
          throw new Error(
            `CV link ${link.id} has an inconsistent content graph.`
          )
        }
      }

      for (const artifact of rowsFor(rows, 'generated_artifacts')) {
        const link = links.get(
          requiredString(artifact, 'cv_link_id', 'generated_artifacts')
        )
        const revision = revisions.get(
          requiredString(artifact, 'content_revision_id', 'generated_artifacts')
        )
        if (
          link === undefined ||
          revision === undefined ||
          requiredString(link, 'content_entry_id', 'cv_links') !==
            requiredString(revision, 'content_entry_id', 'content_revisions')
        ) {
          throw new Error(
            `Generated artifact ${artifact.id} has an inconsistent graph.`
          )
        }
      }
    },
    catch: migrationError(
      'validate D1 relationships',
      'The D1 export contains an inconsistent content/publication graph.'
    ),
  })

const validateSequenceAndLeases = (rows: NormalizedRegistry) =>
  Effect.try({
    try: () => {
      const sequenceRows = rowsFor(rows, 'registry_sequence')
      const sequence =
        sequenceRows.length === 1 ? sequenceRows[0]?.revision : null
      if (typeof sequence !== 'number') {
        throw new Error(
          'registry_sequence must contain exactly one numeric revision.'
        )
      }

      const revisions = [
        ...rowsFor(rows, 'applications').map((row) => row.updated_revision),
        ...rowsFor(rows, 'application_activities').map((row) => row.revision),
      ].filter((value): value is number => typeof value === 'number')
      const maximumRevision = Math.max(1, ...revisions)
      if (sequence < maximumRevision) {
        throw new Error(
          `Registry sequence ${sequence} is behind revision ${maximumRevision}.`
        )
      }

      const now = Date.now()
      const futureLeases = rowsFor(
        rows,
        'application_listing_check_schedules'
      ).filter((row) => {
        const leaseUntil = row.lease_until
        return typeof leaseUntil === 'string' && Date.parse(leaseUntil) > now
      })
      if (futureLeases.length > 0) {
        throw new Error(
          `D1 export contains ${futureLeases.length} active listing-check leases.`
        )
      }
    },
    catch: migrationError(
      'validate D1 sequence',
      'The D1 export is not quiescent or has an invalid registry sequence.'
    ),
  })

export const loadD1Source = (
  path: string,
  expectedSha256: string
): Effect.Effect<D1SourceSnapshot, unknown> =>
  Effect.scoped(
    Effect.gen(function* () {
      const { actualSha256, sql } = yield* readExport(path, expectedSha256)
      const database = yield* openExport(sql)
      yield* validateSQLite(database)
      yield* readTableInventory(database)
      const migrations = yield* readMigrationHistory(database)
      const diagnostics = yield* readSourceDiagnostics(database)
      const tableRows = yield* Effect.forEach(registryTables, (spec) =>
        readTable(database, spec).pipe(
          Effect.map((rows) => [spec.name, rows] as const)
        )
      )
      const rows = new Map<string, readonly RegistryRow[]>(tableRows)
      yield* validateSequenceAndLeases(rows)
      yield* validateUnconstrainedRelationships(rows)

      return { diagnostics, migrations, rows, sha256: actualSha256 }
    })
  )
