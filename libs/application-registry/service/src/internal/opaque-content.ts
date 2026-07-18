import type { ArtifactStoreShape } from '@cv/application-registry-artifact-store'
import type {
  ApplicationsCrud,
  ContentCrud,
} from '@cv/application-registry-crud'
import type {
  ContentEntry,
  ContentRevision,
} from '@cv/application-registry-entity'
import { Effect } from 'effect'

import {
  RegistryArtifactError,
  RegistryBadRequestError,
  RegistryNotFoundError,
} from '../errors'
import type { OpaquePayloadInput } from '../types'
import { findRequiredApplication } from './shared'

export const requireNonEmpty = (value: string, field: string) => {
  const normalized = value.trim()
  return normalized.length > 0
    ? Effect.succeed(normalized)
    : Effect.fail(
        new RegistryBadRequestError({ message: `${field} must not be empty.` })
      )
}

export const findApplicationForContent = (
  applications: ApplicationsCrud,
  identifier: string
) => findRequiredApplication(applications, identifier)

export const requireAssociatedEntry = (
  content: ContentCrud,
  applicationId: string,
  entryId: string
): Effect.Effect<
  ContentEntry,
  | RegistryNotFoundError
  | import('@cv/application-registry-crud').RegistryDatabaseError
> =>
  content.findEntry(entryId).pipe(
    Effect.flatMap((entry) =>
      entry?.applicationId === applicationId
        ? Effect.succeed(entry)
        : Effect.fail(
            new RegistryNotFoundError({
              identifier: entryId,
              message: `Content entry not found: ${entryId}`,
            })
          )
    )
  )

export const requireAssociatedRevision = (
  content: ContentCrud,
  entryId: string,
  revisionId: string
): Effect.Effect<
  ContentRevision,
  | RegistryNotFoundError
  | import('@cv/application-registry-crud').RegistryDatabaseError
> =>
  content.findRevision(revisionId).pipe(
    Effect.flatMap((revision) =>
      revision?.contentEntryId === entryId
        ? Effect.succeed(revision)
        : Effect.fail(
            new RegistryNotFoundError({
              identifier: revisionId,
              message: `Content revision not found: ${revisionId}`,
            })
          )
    )
  )

export const putOpaquePayload = (
  store: ArtifactStoreShape,
  input: OpaquePayloadInput
) =>
  store.put(input.bytes).pipe(
    Effect.mapError(
      (cause) =>
        new RegistryArtifactError({
          cause,
          message: 'Could not store opaque registry content.',
          operation: 'write',
        })
    )
  )

export const readOpaquePayload = (store: ArtifactStoreShape, sha256: string) =>
  store.read(sha256).pipe(
    Effect.mapError(
      (cause) =>
        new RegistryArtifactError({
          cause,
          message: 'Could not read opaque registry content.',
          operation: 'read',
        })
    )
  )
