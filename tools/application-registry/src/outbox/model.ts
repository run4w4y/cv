import {
  AddApplicationNoteRequestSchema,
  AppendApplicationEventRequestSchema,
  CreateCampaignCaptureRequestSchema,
  SubmitListingCheckFindingsRequestSchema,
} from '@cv/application-registry-api-contract'
import { Context, type Effect, Schema } from 'effect'

import type { ApplicationRegistryOutboxError } from '../errors'

const NonEmptyString = Schema.Trim.pipe(Schema.check(Schema.isNonEmpty()))
const NonNegativeInteger = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
)

export const registryOutboxEntryVersion = 3 as const

export const AppendApplicationEventCommandSchema = Schema.Struct({
  _tag: Schema.Literal('AppendApplicationEvent'),
  identifier: NonEmptyString,
  request: AppendApplicationEventRequestSchema,
})

export const AddApplicationNoteCommandSchema = Schema.Struct({
  _tag: Schema.Literal('AddApplicationNote'),
  identifier: NonEmptyString,
  request: AddApplicationNoteRequestSchema,
})

export const CaptureCampaignCommandSchema = Schema.Struct({
  _tag: Schema.Literal('CaptureCampaign'),
  request: CreateCampaignCaptureRequestSchema,
})

export const SubmitListingCheckFindingsCommandSchema = Schema.Struct({
  _tag: Schema.Literal('SubmitListingCheckFindings'),
  batchId: NonEmptyString,
  request: SubmitListingCheckFindingsRequestSchema,
})

export const RegistryCommandSchema = Schema.Union([
  AddApplicationNoteCommandSchema,
  AppendApplicationEventCommandSchema,
  CaptureCampaignCommandSchema,
  SubmitListingCheckFindingsCommandSchema,
])

export type RegistryCommand = Schema.Schema.Type<typeof RegistryCommandSchema>

export const RegistryOutboxDispositionSchema = Schema.Literals([
  'pending',
  'retry',
  'blocked',
  'dead-letter',
])

export type RegistryOutboxDisposition = Schema.Schema.Type<
  typeof RegistryOutboxDispositionSchema
>

export const RegistryOutboxEntrySchema = Schema.Struct({
  attemptCount: NonNegativeInteger,
  command: RegistryCommandSchema,
  createdAt: NonEmptyString,
  disposition: RegistryOutboxDispositionSchema,
  lastFailure: Schema.NullOr(Schema.String),
  version: Schema.Literal(registryOutboxEntryVersion),
})

export type RegistryOutboxEntry = Schema.Schema.Type<
  typeof RegistryOutboxEntrySchema
>

export type EnqueueRegistryCommand = {
  readonly command: RegistryCommand
}

export type RegistryOutboxFailure = {
  readonly disposition: Exclude<RegistryOutboxDisposition, 'pending'>
  readonly message: string
}

export type RegistryOutboxService = {
  readonly enqueue: (
    command: EnqueueRegistryCommand
  ) => Effect.Effect<RegistryOutboxEntry, ApplicationRegistryOutboxError>
  readonly list: () => Effect.Effect<
    readonly RegistryOutboxEntry[],
    ApplicationRegistryOutboxError
  >
  readonly markFailure: (
    entry: RegistryOutboxEntry,
    failure: RegistryOutboxFailure
  ) => Effect.Effect<RegistryOutboxEntry, ApplicationRegistryOutboxError>
  readonly complete: (
    entry: RegistryOutboxEntry
  ) => Effect.Effect<void, ApplicationRegistryOutboxError>
}

export class RegistryOutbox extends Context.Service<
  RegistryOutbox,
  RegistryOutboxService
>()('@cv/application-registry/RegistryOutbox') {}

export const registryCommandOperationId = (command: RegistryCommand) => {
  switch (command._tag) {
    case 'AddApplicationNote':
    case 'AppendApplicationEvent':
    case 'CaptureCampaign':
      return command.request.operationId
    case 'SubmitListingCheckFindings':
      return command.batchId
  }
}

export type AddApplicationNoteCommand = Extract<
  RegistryCommand,
  { readonly _tag: 'AddApplicationNote' }
>

export type AppendApplicationEventCommand = Extract<
  RegistryCommand,
  { readonly _tag: 'AppendApplicationEvent' }
>

export type CaptureCampaignCommand = Extract<
  RegistryCommand,
  { readonly _tag: 'CaptureCampaign' }
>

export type SubmitListingCheckFindingsCommand = Extract<
  RegistryCommand,
  { readonly _tag: 'SubmitListingCheckFindings' }
>
