import type { CvLink } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { ApplicationRegistryError } from '../errors'
import type {
  PublishCvInput,
  ResolvedCvPublication,
  SetCvLinkAvailabilityInput,
} from '../types'

export const applicationRejectedDisableReason = 'application_rejected'

export interface CvPublicationsService {
  readonly disableForApplication: (
    applicationIdentifier: string,
    reason: string
  ) => Effect.Effect<number, ApplicationRegistryError>
  readonly findByEntry: (
    applicationIdentifier: string,
    entryId: string
  ) => Effect.Effect<CvLink, ApplicationRegistryError>
  readonly restoreAfterRejection: (
    applicationIdentifier: string
  ) => Effect.Effect<number, ApplicationRegistryError>
  readonly publish: (
    applicationIdentifier: string,
    entryId: string,
    input: PublishCvInput
  ) => Effect.Effect<CvLink, ApplicationRegistryError>
  readonly resolve: (
    token: string
  ) => Effect.Effect<ResolvedCvPublication, ApplicationRegistryError>
  readonly setAvailability: (
    applicationIdentifier: string,
    entryId: string,
    input: SetCvLinkAvailabilityInput
  ) => Effect.Effect<CvLink, ApplicationRegistryError>
}

export const CvPublicationsService = Context.Service<CvPublicationsService>(
  '@cv/application-registry-service/CvPublicationsService'
)
