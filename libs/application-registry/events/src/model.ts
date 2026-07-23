import {
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
  CvPublicationAvailabilityChanged: {
    ...envelope,
    applicationId: NonEmptyString,
    contentEntryId: NonEmptyString,
    contentRevisionId: NonEmptyString,
    cvLinkId: NonEmptyString,
    enabled: Schema.Boolean,
    publicationVersion: PositiveVersion,
  },
  CvPublicationChanged: {
    ...envelope,
    applicationId: NonEmptyString,
  },
  PdfGenerationRequested: {
    ...envelope,
    applicationId: NonEmptyString,
    contentEntryId: NonEmptyString,
    contentRevisionId: NonEmptyString,
    cvLinkId: NonEmptyString,
    publicationVersion: PositiveVersion,
  },
})

export type RegistryEvent = typeof RegistryEventSchema.Type

export type CvPublicationChangedEvent = Extract<
  RegistryEvent,
  { readonly _tag: 'CvPublicationChanged' }
>

export const isCvPublicationChangedEvent = (
  event: RegistryEvent
): event is CvPublicationChangedEvent => event._tag === 'CvPublicationChanged'

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
