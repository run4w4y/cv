import { Context, type Effect, Schema } from 'effect'

export interface FactsStorageMetadata {
  readonly cacheControl: string | undefined
  /** Opaque value used for conditional writes. */
  readonly etag: string
  readonly mediaType: string | undefined
  /** HTTP representation of the ETag, including quotes when required. */
  readonly responseEtag: string
  readonly sha256: string | undefined
  readonly size: number
}

export interface FactsStorageObject extends FactsStorageMetadata {
  readonly bytes: Uint8Array
}

export type FactsStoragePutCondition =
  | { readonly _tag: 'Create' }
  | { readonly _tag: 'Match'; readonly etag: string }

export interface FactsStoragePutInput {
  readonly bytes: Uint8Array
  readonly cacheControl: string
  readonly condition: FactsStoragePutCondition
  readonly key: string
  readonly mediaType: string
  readonly sha256: string
}

export class FactsStorageError extends Schema.TaggedErrorClass<FactsStorageError>()(
  'FactsStorageError',
  {
    cause: Schema.Defect(),
    key: Schema.String,
    message: Schema.String,
    operation: Schema.Literals(['get', 'head', 'put']),
  }
) {}

export interface FactsStorageShape {
  readonly get: (
    key: string
  ) => Effect.Effect<FactsStorageObject | null, FactsStorageError>
  readonly head: (
    key: string
  ) => Effect.Effect<FactsStorageMetadata | null, FactsStorageError>
  /** Returns false when the storage precondition did not match. */
  readonly put: (
    input: FactsStoragePutInput
  ) => Effect.Effect<boolean, FactsStorageError>
}

export class FactsStorage extends Context.Service<
  FactsStorage,
  FactsStorageShape
>()('@cv/application-registry-api/FactsStorage') {}
