import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

import { artifactKindValues, artifactStatusValues } from '../model/content'
import { sqlStringList } from './checks'
import { contentRevisions } from './content'
import { cvLinks } from './cv-links'

export const generatedArtifacts = sqliteTable(
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
    workflowId: text('workflow_id').notNull(),
    rendererVersion: text('renderer_version').notNull(),
    publicationVersion: integer('publication_version').notNull(),
    qrTarget: text('qr_target').notNull(),
    objectKey: text('object_key'),
    sha256: text('sha256'),
    byteLength: integer('byte_length'),
    mediaType: text('media_type'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    generatedAt: text('generated_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id] }),
    uniqueIndex('generated_artifacts_workflow_unique').on(table.workflowId),
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
