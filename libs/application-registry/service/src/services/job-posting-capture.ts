import type { JobPostingSnapshot } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { ApplicationRegistryError } from '../errors'

export interface JobPostingCaptureService {
  readonly capture: (
    applicationIdentifier: string
  ) => Effect.Effect<JobPostingSnapshot, ApplicationRegistryError>
}

export const JobPostingCaptureService =
  Context.Service<JobPostingCaptureService>(
    '@cv/application-registry-service/JobPostingCaptureService'
  )
