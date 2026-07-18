import type { JobPostingSnapshot } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { ApplicationRegistryError } from '../errors'
import type {
  JobPostingSnapshotPayloadKind,
  PersistJobPostingSnapshotInput,
} from '../types'

export interface JobPostingSnapshotsService {
  readonly find: (
    applicationIdentifier: string,
    snapshotId: string
  ) => Effect.Effect<JobPostingSnapshot, ApplicationRegistryError>
  readonly latest: (
    applicationIdentifier: string
  ) => Effect.Effect<JobPostingSnapshot, ApplicationRegistryError>
  readonly persist: (
    applicationIdentifier: string,
    input: PersistJobPostingSnapshotInput
  ) => Effect.Effect<JobPostingSnapshot, ApplicationRegistryError>
  readonly readPayload: (
    applicationIdentifier: string,
    snapshotId: string,
    kind: JobPostingSnapshotPayloadKind
  ) => Effect.Effect<Uint8Array, ApplicationRegistryError>
}

export const JobPostingSnapshotsService =
  Context.Service<JobPostingSnapshotsService>(
    '@cv/application-registry-service/JobPostingSnapshotsService'
  )
