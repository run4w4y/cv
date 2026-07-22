import { Context, type Effect, type Option } from 'effect'

import type {
  ArtifactStoreHeadError,
  ArtifactStorePutError,
  ArtifactStoreReadFailure,
} from './errors'

export type ArtifactMetadata = {
  readonly byteLength: number
  readonly key: string
  readonly sha256: string
}

export type ArtifactStoreShape = {
  readonly head: (
    sha256: string
  ) => Effect.Effect<Option.Option<ArtifactMetadata>, ArtifactStoreHeadError>
  readonly put: (
    bytes: Uint8Array
  ) => Effect.Effect<ArtifactMetadata, ArtifactStorePutError>
  readonly read: (
    sha256: string
  ) => Effect.Effect<Uint8Array, ArtifactStoreReadFailure>
}

export class ArtifactStore extends Context.Service<
  ArtifactStore,
  ArtifactStoreShape
>()('@cv/application-registry-artifact-store/ArtifactStore') {}
