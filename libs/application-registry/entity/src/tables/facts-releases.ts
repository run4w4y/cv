import { sql } from 'drizzle-orm'
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

export const factsReleases = sqliteTable(
  'facts_releases',
  {
    id: text('id').notNull(),
    factsSchemaVersion: text('facts_schema_version').notNull(),
    sourceRepository: text('source_repository').notNull(),
    sourceCommit: text('source_commit').notNull(),
    compilerRepository: text('compiler_repository').notNull(),
    compilerCommit: text('compiler_commit').notNull(),
    manifestObjectKey: text('manifest_object_key').notNull(),
    manifestSha256: text('manifest_sha256').notNull(),
    manifestByteLength: integer('manifest_byte_length').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('facts_releases_input_unique').on(
      table.sourceRepository,
      table.sourceCommit,
      table.compilerCommit,
      table.factsSchemaVersion
    ),
    check(
      'facts_releases_manifest_byte_length_check',
      sql`${table.manifestByteLength} >= 0`
    ),
  ]
)

export const factsReleaseCatalogs = sqliteTable(
  'facts_release_catalogs',
  {
    releaseId: text('release_id')
      .notNull()
      .references(() => factsReleases.id),
    locale: text('locale').notNull(),
    objectKey: text('object_key').notNull(),
    sha256: text('sha256').notNull(),
    byteLength: integer('byte_length').notNull(),
    mediaType: text('media_type').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.locale] }),
    check(
      'facts_release_catalogs_byte_length_check',
      sql`${table.byteLength} >= 0`
    ),
  ]
)

export const factsReleaseAssets = sqliteTable(
  'facts_release_assets',
  {
    releaseId: text('release_id')
      .notNull()
      .references(() => factsReleases.id),
    assetId: text('asset_id').notNull(),
    fileName: text('file_name').notNull(),
    objectKey: text('object_key').notNull(),
    sha256: text('sha256').notNull(),
    byteLength: integer('byte_length').notNull(),
    mediaType: text('media_type').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.releaseId, table.assetId] }),
    check(
      'facts_release_assets_byte_length_check',
      sql`${table.byteLength} >= 0`
    ),
  ]
)

export const factsChannels = sqliteTable(
  'facts_channels',
  {
    name: text('name').notNull(),
    activeReleaseId: text('active_release_id')
      .notNull()
      .references(() => factsReleases.id),
    version: integer('version').notNull().default(1),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.name] }),
    check('facts_channels_version_check', sql`${table.version} >= 1`),
  ]
)
