import type { ApplicationArtifact } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { ApplicationRegistryError } from '../errors'
import type {
  ApplicationArtifactContent,
  CreateApplicationArtifactInput,
  CreateApplicationArtifactResult,
} from '../types'

export interface ApplicationArtifactsService {
  readonly create: (
    applicationIdentifier: string,
    input: CreateApplicationArtifactInput
  ) => Effect.Effect<CreateApplicationArtifactResult, ApplicationRegistryError>
  readonly find: (
    applicationIdentifier: string,
    artifactId: string
  ) => Effect.Effect<ApplicationArtifact, ApplicationRegistryError>
  readonly list: (
    applicationIdentifier: string
  ) => Effect.Effect<readonly ApplicationArtifact[], ApplicationRegistryError>
  readonly read: (
    applicationIdentifier: string,
    artifactId: string
  ) => Effect.Effect<ApplicationArtifactContent, ApplicationRegistryError>
}

export const ApplicationArtifactsService =
  Context.Service<ApplicationArtifactsService>(
    '@cv/application-registry-service/ApplicationArtifactsService'
  )
