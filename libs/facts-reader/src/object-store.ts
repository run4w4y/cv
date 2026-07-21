import { Context, type Effect } from 'effect'

import type { FactsObjectNotFoundError, FactsObjectStoreError } from './errors'

export type StoredFactsObject = {
  readonly bytes: Uint8Array
  readonly cacheControl: string | undefined
  readonly etag: string | undefined
  readonly mediaType: string | undefined
  readonly sha256: string | undefined
}

export interface FactsObjectStoreShape {
  readonly get: (
    key: string
  ) => Effect.Effect<
    StoredFactsObject,
    FactsObjectNotFoundError | FactsObjectStoreError
  >
}

export class FactsObjectStore extends Context.Service<
  FactsObjectStore,
  FactsObjectStoreShape
>()('@cv/facts-reader/FactsObjectStore') {}
