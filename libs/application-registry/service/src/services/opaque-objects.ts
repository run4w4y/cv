import { Context, type Effect } from 'effect'

import type { RegistryArtifactError } from '../errors'
import type { OpaqueObjectMetadata } from '../types'

export interface OpaqueObjectsService {
  readonly put: (
    bytes: Uint8Array
  ) => Effect.Effect<OpaqueObjectMetadata, RegistryArtifactError>
  readonly read: (
    sha256: string
  ) => Effect.Effect<Uint8Array, RegistryArtifactError>
}

export const OpaqueObjectsService = Context.Service<OpaqueObjectsService>(
  '@cv/application-registry-service/OpaqueObjectsService'
)
