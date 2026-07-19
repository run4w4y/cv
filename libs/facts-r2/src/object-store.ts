import { Context, type Effect } from 'effect'

import type { FactsObjectNotFoundError, FactsObjectStoreError } from './errors'

export type StoredFactsObject = {
  readonly bytes: Uint8Array
  readonly cacheControl: string | undefined
  readonly etag: string | undefined
  readonly mediaType: string | undefined
  readonly sha256: string | undefined
}

export type WritableFactsObject = {
  readonly bytes: Uint8Array
  readonly cacheControl: string
  readonly key: string
  readonly mediaType: string
  readonly sha256: string
}

export interface FactsObjectStoreShape {
  readonly get: (
    key: string
  ) => Effect.Effect<
    StoredFactsObject,
    FactsObjectNotFoundError | FactsObjectStoreError
  >
  readonly putCurrent: (
    object: WritableFactsObject
  ) => Effect.Effect<'activated' | 'already-active', FactsObjectStoreError>
  readonly putImmutable: (
    object: WritableFactsObject
  ) => Effect.Effect<void, FactsObjectStoreError>
}

export class FactsObjectStore extends Context.Service<
  FactsObjectStore,
  FactsObjectStoreShape
>()('@cv/facts-r2/FactsObjectStore') {}
