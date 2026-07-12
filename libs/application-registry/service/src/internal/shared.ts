import {
  type ApplicationsCrud,
  type OperationsCrud,
  type PersistedCompensation,
  RegistryDatabaseError,
} from '@cv/application-registry-crud'
import type {
  Application,
  ApplicationCompensationInput,
  ApplicationEvent,
  ApplicationNote,
  CampaignCapture,
  CommandKind,
  CommandReceipt,
  UtcIsoTimestamp,
} from '@cv/application-registry-entity'
import { DateTime, Effect } from 'effect'

import { RegistryConflictError, RegistryNotFoundError } from '../errors'
import type { RegistryIds } from '../ids/service'

export type OperationIdentity = {
  readonly applicationId?: string
  readonly kind: CommandKind
  readonly operationId: string
  readonly requestFingerprint: string
}

export const registryNow: Effect.Effect<UtcIsoTimestamp> = DateTime.now.pipe(
  Effect.map(DateTime.formatIso)
)

export const decorateCompensations = (
  compensations: readonly ApplicationCompensationInput[] | undefined,
  ids: RegistryIds
): Effect.Effect<readonly PersistedCompensation[] | undefined> =>
  compensations === undefined
    ? Effect.succeed(undefined)
    : Effect.forEach(compensations, (compensation) =>
        ids.next.pipe(Effect.map((id) => ({ ...compensation, id })))
      )

export const requireApplication = (
  value: Application | undefined,
  identifier: string
) =>
  value
    ? Effect.succeed(value)
    : Effect.fail(
        new RegistryNotFoundError({
          identifier,
          message: `Application not found: ${identifier}`,
        })
      )

export const requireEvent = (
  value: ApplicationEvent | undefined,
  operationId: string
) =>
  value
    ? Effect.succeed(value)
    : Effect.fail(
        new RegistryDatabaseError({
          cause: new Error('An operation receipt has no application event.'),
          message: `Application event is missing for ${operationId}`,
        })
      )

export const requireCapture = (
  value: CampaignCapture | undefined,
  operationId: string
) =>
  value
    ? Effect.succeed(value)
    : Effect.fail(
        new RegistryDatabaseError({
          cause: new Error('An operation receipt has no campaign capture.'),
          message: `Campaign capture is missing for ${operationId}`,
        })
      )

export const requireNote = (
  value: ApplicationNote | undefined,
  noteId: string
) =>
  value
    ? Effect.succeed(value)
    : Effect.fail(
        new RegistryDatabaseError({
          cause: new Error('An operation receipt has no application note.'),
          message: `Application note is missing: ${noteId}`,
        })
      )

export const findRequiredApplication = (
  applications: ApplicationsCrud,
  identifier: string
) =>
  applications
    .findByIdentifier(identifier)
    .pipe(
      Effect.flatMap((application) =>
        requireApplication(application, identifier)
      )
    )

const validateOperation = (
  receipt: CommandReceipt,
  expected: OperationIdentity
) =>
  (expected.applicationId === undefined ||
    receipt.applicationId === expected.applicationId) &&
  receipt.kind === expected.kind &&
  receipt.operationId === expected.operationId &&
  receipt.requestFingerprint === expected.requestFingerprint
    ? Effect.void
    : Effect.fail(
        new RegistryConflictError({
          message:
            'The operation id is already used by a different registry request.',
        })
      )

export const findValidatedOperation = (
  operations: OperationsCrud,
  identity: OperationIdentity
) =>
  operations
    .find(identity.operationId)
    .pipe(
      Effect.flatMap((receipt) =>
        receipt
          ? validateOperation(receipt, identity).pipe(Effect.as(receipt))
          : Effect.succeed(undefined)
      )
    )

export const recoverConcurrentReplay = <A>(
  operations: OperationsCrud,
  identity: OperationIdentity,
  write: Effect.Effect<A, RegistryDatabaseError>
) =>
  write.pipe(
    Effect.as(false),
    Effect.catchTag('RegistryDatabaseError', (failure) =>
      findValidatedOperation(operations, identity).pipe(
        Effect.flatMap((receipt) =>
          receipt ? Effect.succeed(true) : Effect.fail(failure)
        )
      )
    )
  )

export const requireReceiptNoteId = (receipt: CommandReceipt) =>
  receipt.noteId
    ? Effect.succeed(receipt.noteId)
    : Effect.fail(
        new RegistryDatabaseError({
          cause: new Error('Application note receipt has no note id.'),
          message: `Application note receipt is invalid: ${receipt.operationId}`,
        })
      )

export const missingRegistryData = (message: string) =>
  new RegistryDatabaseError({ cause: new Error(message), message })
