import type { ApplicationArtifact } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type { RegistryDatabaseError } from '../errors'
import type { PersistedUploadedApplicationArtifact } from '../types'

export interface ApplicationArtifactsCrud {
  readonly find: (
    id: string
  ) => Effect.Effect<ApplicationArtifact | undefined, RegistryDatabaseError>
  readonly findByGeneratedArtifactId: (
    generatedArtifactId: string
  ) => Effect.Effect<ApplicationArtifact | undefined, RegistryDatabaseError>
  readonly listByApplication: (
    applicationId: string
  ) => Effect.Effect<readonly ApplicationArtifact[], RegistryDatabaseError>
  readonly persistUploaded: (
    applicationId: string,
    input: PersistedUploadedApplicationArtifact
  ) => Effect.Effect<void, RegistryDatabaseError>
}

export const ApplicationArtifactsCrud =
  Context.Service<ApplicationArtifactsCrud>(
    '@cv/application-registry-crud/ApplicationArtifactsCrud'
  )
