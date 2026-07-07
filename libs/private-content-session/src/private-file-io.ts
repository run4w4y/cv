import { Context, Data, type Effect } from 'effect'

export class PrivateContentFileError extends Data.TaggedError(
  'PrivateContentFileError'
)<{
  readonly cause?: unknown
  readonly message: string
  readonly operation: string
}> {}

export type PrivateContentFileIOService = {
  readonly fetchBytes: (
    href: string
  ) => Effect.Effect<Uint8Array, PrivateContentFileError>
  readonly saveBytes: (
    bytes: Uint8Array,
    filename: string
  ) => Effect.Effect<void, PrivateContentFileError>
}

export class PrivateContentFileIO extends Context.Service<
  PrivateContentFileIO,
  PrivateContentFileIOService
>()('@cv/private-content-session/PrivateContentFileIO') {}
