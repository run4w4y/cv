import {
  type ApplicationsCrud,
  type IdempotencyCrud,
  type PersistedCompensation,
  RegistryDatabaseError,
} from '@cv/application-registry-crud'
import type {
  Application,
  ApplicationCompensationInput,
  ApplicationNote,
  IdempotencyReceipt,
  IdempotencyScope,
  UtcIsoTimestamp,
} from '@cv/application-registry-entity'
import { DateTime, Effect } from 'effect'

import { RegistryConflictError, RegistryNotFoundError } from '../errors'

export type IdempotencyIdentity = {
  readonly applicationId?: string
  readonly scope: IdempotencyScope
  readonly idempotencyKey: string
  readonly requestHash: string
}

export const registryNow: Effect.Effect<UtcIsoTimestamp> = DateTime.now.pipe(
  Effect.map(DateTime.formatIso)
)

export const newRegistryId = () => globalThis.crypto.randomUUID()

export const decorateCompensations = (
  compensations: readonly ApplicationCompensationInput[] | undefined
): readonly PersistedCompensation[] | undefined =>
  compensations?.map((compensation) => ({
    ...compensation,
    id: newRegistryId(),
  }))

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

const validateIdempotency = (
  receipt: IdempotencyReceipt,
  expected: IdempotencyIdentity
) =>
  (expected.applicationId === undefined ||
    receipt.applicationId === expected.applicationId) &&
  receipt.scope === expected.scope &&
  receipt.idempotencyKey === expected.idempotencyKey &&
  receipt.requestHash === expected.requestHash
    ? Effect.void
    : Effect.fail(
        new RegistryConflictError({
          message:
            'The idempotency key is already used by a different registry request.',
        })
      )

export const findValidatedIdempotency = (
  idempotency: IdempotencyCrud,
  identity: IdempotencyIdentity
) =>
  idempotency
    .find(identity.idempotencyKey)
    .pipe(
      Effect.flatMap((receipt) =>
        receipt
          ? validateIdempotency(receipt, identity).pipe(Effect.as(receipt))
          : Effect.succeed(undefined)
      )
    )

export const recoverConcurrentReplay = <A>(
  idempotency: IdempotencyCrud,
  identity: IdempotencyIdentity,
  write: Effect.Effect<A, RegistryDatabaseError>
) =>
  write.pipe(
    Effect.as(false),
    Effect.catchTag('RegistryDatabaseError', (failure) =>
      findValidatedIdempotency(idempotency, identity).pipe(
        Effect.flatMap((receipt) =>
          receipt ? Effect.succeed(true) : Effect.fail(failure)
        )
      )
    )
  )

export const requireReceiptResourceId = (receipt: IdempotencyReceipt) =>
  receipt.resourceId
    ? Effect.succeed(receipt.resourceId)
    : Effect.fail(
        new RegistryDatabaseError({
          cause: new Error('Application note receipt has no note id.'),
          message: `Idempotency receipt is invalid: ${receipt.idempotencyKey}`,
        })
      )

export const missingRegistryData = (message: string) =>
  new RegistryDatabaseError({ cause: new Error(message), message })
