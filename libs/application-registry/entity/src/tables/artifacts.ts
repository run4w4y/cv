import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

import {
  applicationArtifactCategoryValues,
  applicationArtifactSourceValues,
  artifactKindValues,
  artifactStatusValues,
} from '../model/content'
import { applications } from './applications'
import { sqlStringList } from './checks'
import { utcTimestamp } from './columns'
import { contentRevisions } from './content'
import { cvLinks } from './cv-links'

export const generatedArtifacts = pgTable(
  'generated_artifacts',
  {
    id: text('id').notNull(),
    cvLinkId: text('cv_link_id')
      .notNull()
      .references(() => cvLinks.id, { onDelete: 'cascade' }),
    contentRevisionId: text('content_revision_id')
      .notNull()
      .references(() => contentRevisions.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: artifactKindValues }).notNull(),
    status: text('status', { enum: artifactStatusValues }).notNull(),
    requestId: text('request_id').notNull(),
    rendererVersion: text('renderer_version').notNull(),
    publicationVersion: integer('publication_version').notNull(),
    qrTarget: text('qr_target').notNull(),
    objectKey: text('object_key'),
    sha256: text('sha256'),
    byteLength: integer('byte_length'),
    mediaType: text('media_type'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    generatedAt: utcTimestamp('generated_at'),
    createdAt: utcTimestamp('created_at').notNull(),
    updatedAt: utcTimestamp('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('generated_artifacts_request_unique').on(table.requestId),
    index('generated_artifacts_publication_status_idx').on(
      table.cvLinkId,
      table.contentRevisionId,
      table.rendererVersion,
      table.publicationVersion,
      table.status,
      table.updatedAt
    ),
    index('generated_artifacts_link_status_idx').on(
      table.cvLinkId,
      table.status,
      table.updatedAt
    ),
    check(
      'generated_artifacts_kind_check',
      sql`${table.kind} in (${sqlStringList(artifactKindValues)})`
    ),
    check(
      'generated_artifacts_status_check',
      sql`${table.status} in (${sqlStringList(artifactStatusValues)})`
    ),
    check(
      'generated_artifacts_byte_length_check',
      sql`${table.byteLength} is null or ${table.byteLength} >= 0`
    ),
    check(
      'generated_artifacts_publication_version_check',
      sql`${table.publicationVersion} >= 1`
    ),
  ]
)

export const applicationArtifacts = pgTable(
  'application_artifacts',
  {
    id: text('id').notNull(),
    applicationId: text('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    category: text('category', {
      enum: applicationArtifactCategoryValues,
    }).notNull(),
    filename: text('filename').notNull(),
    mediaType: text('media_type').notNull(),
    objectKey: text('object_key').notNull(),
    sha256: text('sha256').notNull(),
    byteLength: integer('byte_length').notNull(),
    source: text('source', {
      enum: applicationArtifactSourceValues,
    }).notNull(),
    locale: text('locale'),
    contentRevisionId: text('content_revision_id').references(
      () => contentRevisions.id,
      { onDelete: 'set null' }
    ),
    generatedArtifactId: text('generated_artifact_id').references(
      () => generatedArtifacts.id,
      { onDelete: 'set null' }
    ),
    createdAt: utcTimestamp('created_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('application_artifacts_generated_unique').on(
      table.generatedArtifactId
    ),
    index('application_artifacts_application_created_idx').on(
      table.applicationId,
      table.createdAt,
      table.id
    ),
    check(
      'application_artifacts_category_check',
      sql`${table.category} in (${sqlStringList(applicationArtifactCategoryValues)})`
    ),
    check(
      'application_artifacts_source_check',
      sql`${table.source} in (${sqlStringList(applicationArtifactSourceValues)})`
    ),
    check(
      'application_artifacts_filename_check',
      sql`length(btrim(${table.filename})) > 0`
    ),
    check(
      'application_artifacts_media_type_check',
      sql`length(btrim(${table.mediaType})) > 0`
    ),
    check(
      'application_artifacts_sha256_check',
      sql`${table.sha256} ~ '^[0-9a-f]{64}$'`
    ),
    check(
      'application_artifacts_object_key_check',
      sql`${table.objectKey} = 'sha256/' || ${table.sha256}`
    ),
    check(
      'application_artifacts_byte_length_check',
      sql`${table.byteLength} >= 0`
    ),
  ]
)
