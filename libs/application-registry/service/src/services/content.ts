import type {
  ContentEntry,
  ContentRevision,
} from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { ApplicationRegistryError } from '../errors'
import type {
  AppendContentRevisionInput,
  ApproveContentRevisionInput,
  ContentRevisionResult,
  CreateContentEntryInput,
  OpaqueContentRevision,
} from '../types'

export interface ContentEntriesService {
  readonly appendRevision: (
    applicationIdentifier: string,
    entryId: string,
    input: AppendContentRevisionInput
  ) => Effect.Effect<ContentRevisionResult, ApplicationRegistryError>
  readonly approveRevision: (
    applicationIdentifier: string,
    entryId: string,
    input: ApproveContentRevisionInput
  ) => Effect.Effect<ContentRevisionResult, ApplicationRegistryError>
  readonly ensure: (
    applicationIdentifier: string,
    input: CreateContentEntryInput
  ) => Effect.Effect<ContentEntry, ApplicationRegistryError>
  readonly find: (
    applicationIdentifier: string,
    entryId: string
  ) => Effect.Effect<ContentEntry, ApplicationRegistryError>
  readonly listRevisions: (
    applicationIdentifier: string,
    entryId: string
  ) => Effect.Effect<readonly ContentRevision[], ApplicationRegistryError>
  readonly readRevision: (
    applicationIdentifier: string,
    entryId: string,
    revisionId: string
  ) => Effect.Effect<OpaqueContentRevision, ApplicationRegistryError>
}

export const ContentEntriesService = Context.Service<ContentEntriesService>(
  '@cv/application-registry-service/ContentEntriesService'
)
