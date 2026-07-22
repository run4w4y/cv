import { Schema } from 'effect'

export const JobSnapshotStatusSchema = Schema.Literals([
  'fetched',
  'provided',
  'failed',
])
export const jobSnapshotStatusValues = JobSnapshotStatusSchema.literals
export type JobSnapshotStatus = Schema.Schema.Type<
  typeof JobSnapshotStatusSchema
>

export const ContentEntryKindSchema = Schema.Literals(['cv', 'cover_letter'])
export const contentEntryKindValues = ContentEntryKindSchema.literals
export type ContentEntryKind = Schema.Schema.Type<typeof ContentEntryKindSchema>

export const ContentEntryStateSchema = Schema.Literals(['draft', 'approved'])
export const contentEntryStateValues = ContentEntryStateSchema.literals
export type ContentEntryState = Schema.Schema.Type<
  typeof ContentEntryStateSchema
>

export const ContentRevisionSourceSchema = Schema.Literals([
  'ai',
  'human',
  'ai_adjustment',
  'migration',
])
export const contentRevisionSourceValues = ContentRevisionSourceSchema.literals
export type ContentRevisionSource = Schema.Schema.Type<
  typeof ContentRevisionSourceSchema
>

export const ArtifactKindSchema = Schema.Literals(['pdf'])
export const artifactKindValues = ArtifactKindSchema.literals
export type ArtifactKind = Schema.Schema.Type<typeof ArtifactKindSchema>

export const ArtifactStatusSchema = Schema.Literals([
  'pending',
  'ready',
  'failed',
])
export const artifactStatusValues = ArtifactStatusSchema.literals
export type ArtifactStatus = Schema.Schema.Type<typeof ArtifactStatusSchema>

export const pdfGenerationFailedDisableReason = 'pdf_generation_failed'
