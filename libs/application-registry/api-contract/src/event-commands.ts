import {
  ExpectedApplicationVersionSchema,
  NonEmptyTrimmedStringSchema as NonEmptyString,
} from '@cv/application-registry-entity'
import { Schema } from 'effect'

export const RequestPdfGenerationRequestSchema = Schema.Struct({
  expectedPublicationVersion: ExpectedApplicationVersionSchema,
})
export interface RequestPdfGenerationRequest
  extends Schema.Schema.Type<typeof RequestPdfGenerationRequestSchema> {}

export const RegistryEventAcceptedResponseSchema = Schema.Struct({
  eventId: NonEmptyString,
})
export interface RegistryEventAcceptedResponse
  extends Schema.Schema.Type<typeof RegistryEventAcceptedResponseSchema> {}
