import { Data } from 'effect'

export class PrivateRuntimeManifestError extends Data.TaggedError(
  'PrivateRuntimeManifestError'
)<{
  readonly message: string
  readonly cause?: unknown
}> {}
