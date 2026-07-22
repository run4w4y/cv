import {
  ApplicationStatusSchema,
  NonEmptyTrimmedStringSchema,
  UtcIsoTimestampSchema,
} from '@cv/application-registry-entity'
import { Schema } from 'effect'

const NonEmptyString = NonEmptyTrimmedStringSchema
const PositiveVersion = Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0)))

const envelope = {
  correlationId: NonEmptyString,
  eventId: NonEmptyString,
  occurredAt: UtcIsoTimestampSchema,
  version: Schema.Literal(1),
}

export const RegistryEventSchema = Schema.TaggedUnion({
  ApplicationCreated: {
    ...envelope,
    applicationId: NonEmptyString,
  },
  ApplicationUpdated: {
    ...envelope,
    applicationId: NonEmptyString,
    applicationVersion: PositiveVersion,
    changedFields: Schema.Array(NonEmptyString),
    status: ApplicationStatusSchema,
  },
  ApplicationRemoved: {
    ...envelope,
    applicationId: NonEmptyString,
  },
  ApplicationNoteAdded: {
    ...envelope,
    applicationId: NonEmptyString,
    noteId: NonEmptyString,
  },
  CompensationChanged: {
    ...envelope,
    applicationId: NonEmptyString,
  },
  ContentEntryCreated: {
    ...envelope,
    applicationId: NonEmptyString,
    contentEntryId: NonEmptyString,
    kind: Schema.Literals(['cover_letter', 'cv']),
    locale: NonEmptyString,
  },
  ContentRevisionAppended: {
    ...envelope,
    applicationId: NonEmptyString,
    contentEntryId: NonEmptyString,
    contentRevisionId: NonEmptyString,
    contentVersion: PositiveVersion,
  },
  ContentRevisionApproved: {
    ...envelope,
    applicationId: NonEmptyString,
    contentEntryId: NonEmptyString,
    contentRevisionId: NonEmptyString,
    contentVersion: PositiveVersion,
  },
  CvPublicationStaged: {
    ...envelope,
    applicationId: NonEmptyString,
    contentEntryId: NonEmptyString,
    contentRevisionId: NonEmptyString,
    cvLinkId: NonEmptyString,
    publicationVersion: PositiveVersion,
  },
  CvPublicationAvailabilityChanged: {
    ...envelope,
    applicationId: NonEmptyString,
    contentEntryId: NonEmptyString,
    contentRevisionId: NonEmptyString,
    cvLinkId: NonEmptyString,
    enabled: Schema.Boolean,
    publicationVersion: PositiveVersion,
  },
  PdfGenerationRequested: {
    ...envelope,
    applicationId: NonEmptyString,
    contentEntryId: NonEmptyString,
    contentRevisionId: NonEmptyString,
    cvLinkId: NonEmptyString,
    publicationVersion: PositiveVersion,
  },
  PdfGenerated: {
    ...envelope,
    applicationId: NonEmptyString,
    artifactId: NonEmptyString,
    contentEntryId: NonEmptyString,
    publicationVersion: PositiveVersion,
  },
  PdfGenerationFailed: {
    ...envelope,
    applicationId: NonEmptyString,
    artifactId: NonEmptyString,
    code: NonEmptyString,
    contentEntryId: NonEmptyString,
    publicationVersion: PositiveVersion,
  },
  JobPostingSnapshotPersisted: {
    ...envelope,
    applicationId: NonEmptyString,
    snapshotId: NonEmptyString,
  },
  ListingCheckCompleted: {
    ...envelope,
    applicationId: NonEmptyString,
    outcome: Schema.Literals(['closed', 'open', 'unknown']),
    runId: Schema.NullOr(NonEmptyString),
  },
})

export type RegistryEvent = typeof RegistryEventSchema.Type

export type PdfGenerationTriggerEvent =
  | (Extract<
      RegistryEvent,
      { readonly _tag: 'CvPublicationAvailabilityChanged' }
    > & { readonly enabled: true })
  | Extract<RegistryEvent, { readonly _tag: 'PdfGenerationRequested' }>

export const isPdfGenerationTriggerEvent = (
  event: RegistryEvent
): event is PdfGenerationTriggerEvent =>
  event._tag === 'PdfGenerationRequested' ||
  (event._tag === 'CvPublicationAvailabilityChanged' && event.enabled)
