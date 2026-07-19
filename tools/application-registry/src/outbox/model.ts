import {
  AddApplicationNoteRequestSchema,
  SubmitListingCheckFindingsRequestSchema,
} from '@cv/application-registry-api-contract'
import { Context, type Effect, Schema } from 'effect'

import type { ApplicationRegistryOutboxError } from '../errors'

const NonEmptyString = Schema.Trim.pipe(Schema.check(Schema.isNonEmpty()))
const NonNegativeInteger = Schema.Int.pipe(
  Schema.check(Schema.isGreaterThanOrEqualTo(0))
)

export const registryOutboxEntryVersion = 4 as const

export const AddApplicationNoteCommandSchema = Schema.Struct({
  _tag: Schema.Literal('AddApplicationNote'),
  idempotencyKey: NonEmptyString,
  identifier: NonEmptyString,
  request: AddApplicationNoteRequestSchema,
})

export const SubmitListingCheckFindingsCommandSchema = Schema.Struct({
  _tag: Schema.Literal('SubmitListingCheckFindings'),
  batchId: NonEmptyString,
  request: SubmitListingCheckFindingsRequestSchema,
  runId: NonEmptyString,
})

export const RegistryCommandSchema = Schema.Union([
  AddApplicationNoteCommandSchema,
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
      return command.idempotencyKey
    case 'SubmitListingCheckFindings':
      return command.batchId
  }
}

export type AddApplicationNoteCommand = Extract<
  RegistryCommand,
  { readonly _tag: 'AddApplicationNote' }
>

export type SubmitListingCheckFindingsCommand = Extract<
  RegistryCommand,
  { readonly _tag: 'SubmitListingCheckFindings' }
>
