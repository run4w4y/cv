import { Data } from 'effect'
import type { PlatformError } from 'effect/PlatformError'

export class ContentTypesGenerationError extends Data.TaggedError(
  'ContentTypesGenerationError'
)<{
  readonly cause: unknown
  readonly message: string
}> {}

export class ContentTypesFileSystemError extends Data.TaggedError(
  'ContentTypesFileSystemError'
)<{
  readonly cause: PlatformError
  readonly operation: string
  readonly path: string
}> {
  override get message() {
    return `Could not ${this.operation} ${this.path}`
  }
}
