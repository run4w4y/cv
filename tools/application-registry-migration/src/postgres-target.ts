import { createHash } from 'node:crypto'
import { PgClient } from '@effect/sql-pg'
import { Config, Effect, type Redacted } from 'effect'

import type { D1SourceSnapshot } from './d1-source'
import { migrationError, migrationFailure } from './errors'
import { registryTables, type TableSpec } from './manifest'
import { normalizeRow, type RegistryRow, tableDigest } from './transform'

export interface PostgresImportResult {
  readonly alreadyImported: boolean
  readonly counts: Readonly<Record<string, number>>
  readonly sourceSha256: string
}

export interface PostgresImportConfiguration {
  readonly database: string
  readonly host: string
  readonly maxConnections: number
  readonly password: Redacted.Redacted<string>
  readonly port: number
  readonly username: string
}

export const postgresClientLayer = (
  config: PostgresImportConfiguration,
  applicationName: string
) =>
  PgClient.layer({
    applicationName,
    connectTimeout: '10 seconds',
    database: config.database,
    host: config.host,
    maxConnections: config.maxConnections,
    password: config.password,
    port: config.port,
    username: config.username,
  })

/** SHA-256 of the complete PostgreSQL `public` baseline catalog contract. */
export const expectedTargetBaselineFingerprint =
  '39277ef44f3bfd82106d7be3baaa9f87138deac49e7cbd6a54c34d5bdb3f1512'

export const targetCatalogFingerprint = (
  signatures: readonly string[]
): string =>
  createHash('sha256')
    .update([...signatures].toSorted().join('\n'))
    .digest('hex')

export const validateTargetBaselineFingerprint = (actual: string) =>
  actual === expectedTargetBaselineFingerprint
    ? Effect.void
    : Effect.fail(
        migrationFailure(
          'verify PostgreSQL baseline',
          `PostgreSQL public schema does not match the fresh registry baseline: expected ${expectedTargetBaselineFingerprint}, received ${actual}.`
        )
      )

export const targetCatalogQuery = `
  select signature
  from (
    select format(
      'T|%s|%s|%s|%s',
      relation.relname,
      relation.relkind,
      relation.relrowsecurity,
      relation.relforcerowsecurity
    ) as signature
    from pg_catalog.pg_class relation
    inner join pg_catalog.pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')

    union all

    select format(
      'C|%s|%s|%s|%s|%s|%s|%s|%s',
      relation.relname,
      attribute.attnum,
      attribute.attname,
      pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
      attribute.attnotnull,
      coalesce(pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid), ''),
      attribute.attidentity,
      attribute.attgenerated
    ) as signature
    from pg_catalog.pg_class relation
    inner join pg_catalog.pg_namespace namespace
      on namespace.oid = relation.relnamespace
    inner join pg_catalog.pg_attribute attribute
      on attribute.attrelid = relation.oid
    left join pg_catalog.pg_attrdef default_value
      on default_value.adrelid = relation.oid
      and default_value.adnum = attribute.attnum
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and attribute.attnum > 0
      and not attribute.attisdropped

    union all

    select format(
      'K|%s|%s|%s|%s',
      relation.relname,
      constraint_record.contype,
      constraint_record.conname,
      pg_catalog.pg_get_constraintdef(constraint_record.oid, true)
    ) as signature
    from pg_catalog.pg_constraint constraint_record
    inner join pg_catalog.pg_class relation
      on relation.oid = constraint_record.conrelid
    inner join pg_catalog.pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'

    union all

    select format(
      'I|%s|%s|%s',
      table_relation.relname,
      index_relation.relname,
      pg_catalog.pg_get_indexdef(index_record.indexrelid, 0, true)
    ) as signature
    from pg_catalog.pg_index index_record
    inner join pg_catalog.pg_class table_relation
      on table_relation.oid = index_record.indrelid
    inner join pg_catalog.pg_class index_relation
      on index_relation.oid = index_record.indexrelid
    inner join pg_catalog.pg_namespace namespace
      on namespace.oid = table_relation.relnamespace
    where namespace.nspname = 'public'
  ) target_catalog
  order by signature
`

export const readPostgresImportConfiguration: Effect.Effect<
  PostgresImportConfiguration,
  unknown
> = Effect.all({
  database: Config.nonEmptyString('POSTGRES_DATABASE'),
  host: Config.nonEmptyString('POSTGRES_HOST'),
  maxConnections: Config.int('POSTGRES_MAX_CONNECTIONS').pipe(
    Config.withDefault(4)
  ),
  password: Config.redacted('POSTGRES_PASSWORD'),
  port: Config.port('POSTGRES_PORT').pipe(Config.withDefault(5432)),
  username: Config.nonEmptyString('POSTGRES_USER'),
}).pipe(
  Effect.flatMap((config) =>
    config.maxConnections > 0
      ? Effect.succeed(config)
      : Effect.fail(
          migrationFailure(
            'read PostgreSQL configuration',
            'POSTGRES_MAX_CONNECTIONS must be greater than zero.'
          )
        )
  ),
  Effect.mapError((cause) =>
    migrationError(
      'read PostgreSQL configuration',
      'PostgreSQL migration configuration is invalid.'
    )(cause)
  )
)

const quoteIdentifier = (value: string): string =>
  `"${value.replaceAll('"', '""')}"`

const sourceRows = (snapshot: D1SourceSnapshot, table: string) =>
  snapshot.rows.get(table) ?? []

const readTargetTable = (client: PgClient.PgClient, spec: TableSpec) => {
  const columns = spec.columns.map(quoteIdentifier).join(', ')
  const query = `select ${columns} from ${quoteIdentifier(spec.name)}`
  return client.unsafe<RegistryRow>(query).pipe(
    Effect.mapError(
      migrationError(
        'read PostgreSQL table',
        `Could not read PostgreSQL table ${spec.name}; apply the fresh migration first.`
      )
    ),
    Effect.flatMap((rows) =>
      Effect.forEach(rows, (row) => normalizeRow(spec, row, 'postgres'))
    )
  )
}

const readTarget = (client: PgClient.PgClient) =>
  Effect.forEach(registryTables, (spec) =>
    readTargetTable(client, spec).pipe(
      Effect.map((rows) => [spec.name, rows] as const)
    )
  ).pipe(
    Effect.map((entries) => new Map<string, readonly RegistryRow[]>(entries))
  )

const compareTarget = (
  snapshot: D1SourceSnapshot,
  target: ReadonlyMap<string, readonly RegistryRow[]>
) =>
  Effect.forEach(registryTables, (spec) => {
    const expected = sourceRows(snapshot, spec.name)
    const actual = target.get(spec.name) ?? []
    const expectedDigest = tableDigest(spec, expected)
    const actualDigest = tableDigest(spec, actual)
    return expected.length === actual.length && expectedDigest === actualDigest
      ? Effect.succeed([spec.name, expected.length] as const)
      : Effect.fail(
          migrationFailure(
            'verify PostgreSQL import',
            `${spec.name} mismatch: source ${expected.length}/${expectedDigest}, target ${actual.length}/${actualDigest}.`
          )
        )
  }).pipe(Effect.map((counts) => Object.fromEntries(counts)))

const insertChunk = (
  client: PgClient.PgClient,
  spec: TableSpec,
  rows: readonly RegistryRow[]
) => {
  const params: unknown[] = []
  const jsonColumns = new Set(spec.json ?? [])
  const valuesSql = rows.map((row) => {
    const placeholders = spec.columns.map((column) => {
      const value = row[column]
      params.push(
        jsonColumns.has(column) && value !== null
          ? JSON.stringify(value)
          : value
      )
      return `$${params.length}`
    })
    return `(${placeholders.join(', ')})`
  })
  const columns = spec.columns.map(quoteIdentifier).join(', ')
  const statement = `insert into ${quoteIdentifier(spec.name)} (${columns}) values ${valuesSql.join(', ')}`

  return client
    .unsafe<Record<string, never>>(statement, params)
    .pipe(
      Effect.asVoid,
      Effect.mapError(
        migrationError(
          'insert PostgreSQL rows',
          `Could not import ${spec.name}.`
        )
      )
    )
}

const insertTable = (
  client: PgClient.PgClient,
  spec: TableSpec,
  rows: readonly RegistryRow[]
) =>
  Effect.forEach(
    Array.from({ length: Math.ceil(rows.length / 200) }, (_, index) =>
      rows.slice(index * 200, (index + 1) * 200)
    ),
    (chunk) => insertChunk(client, spec, chunk),
    { discard: true }
  )

const insertSnapshot = (
  client: PgClient.PgClient,
  snapshot: D1SourceSnapshot
) =>
  Effect.forEach(
    registryTables,
    (spec) => insertTable(client, spec, sourceRows(snapshot, spec.name)),
    { discard: true }
  )

const selectPublicSchema = (client: PgClient.PgClient) =>
  client
    .unsafe<Record<string, never>>('set local search_path to public')
    .pipe(
      Effect.asVoid,
      Effect.mapError(
        migrationError(
          'select PostgreSQL schema',
          'Could not select the PostgreSQL public schema.'
        )
      )
    )

export const verifyTargetBaseline = (client: PgClient.PgClient) =>
  client.unsafe<{ signature: string }>(targetCatalogQuery).pipe(
    Effect.mapError(
      migrationError(
        'inspect PostgreSQL baseline',
        'Could not inspect the PostgreSQL target catalog.'
      )
    ),
    Effect.flatMap((rows) =>
      validateTargetBaselineFingerprint(
        targetCatalogFingerprint(rows.map(({ signature }) => signature))
      )
    )
  )

const acquireImportLock = (client: PgClient.PgClient) =>
  client
    .unsafe<{
      acquired: boolean
    }>('select pg_try_advisory_xact_lock(hashtext($1)) as acquired', [
      'cv-registry-d1-import-v1',
    ])
    .pipe(
      Effect.mapError(
        migrationError(
          'lock PostgreSQL import',
          'Could not check the PostgreSQL migration lock.'
        )
      ),
      Effect.flatMap((rows) =>
        rows.at(0)?.acquired === true
          ? Effect.void
          : Effect.fail(
              migrationFailure(
                'lock PostgreSQL import',
                'Another registry import owns the PostgreSQL migration lock; no data was written.'
              )
            )
      )
    )

const importWithClient = (snapshot: D1SourceSnapshot) =>
  Effect.gen(function* () {
    const client = yield* PgClient.PgClient
    return yield* client.withTransaction(
      Effect.gen(function* () {
        yield* acquireImportLock(client)
        yield* selectPublicSchema(client)
        yield* verifyTargetBaseline(client)
        const before = yield* readTarget(client)
        const occupied = Array.from(before.values()).some(
          (rows) => rows.length > 0
        )

        if (occupied) {
          const counts = yield* compareTarget(snapshot, before)
          return {
            alreadyImported: true,
            counts,
            sourceSha256: snapshot.sha256,
          }
        }

        yield* insertSnapshot(client, snapshot)
        yield* client
          .unsafe<Record<string, never>>('set constraints all immediate')
          .pipe(
            Effect.asVoid,
            Effect.mapError(
              migrationError(
                'validate PostgreSQL constraints',
                'PostgreSQL rejected the imported relationship graph.'
              )
            )
          )
        const after = yield* readTarget(client)
        const counts = yield* compareTarget(snapshot, after)
        return {
          alreadyImported: false,
          counts,
          sourceSha256: snapshot.sha256,
        }
      })
    )
  })

export const importD1IntoPostgres = (
  snapshot: D1SourceSnapshot,
  config: PostgresImportConfiguration
): Effect.Effect<PostgresImportResult, unknown> =>
  importWithClient(snapshot).pipe(
    Effect.provide(postgresClientLayer(config, 'cv-registry-d1-import'))
  )
