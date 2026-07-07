import { Data, Effect } from 'effect'

export class ContentBuildUsageError extends Data.TaggedError(
  'ContentBuildUsageError'
)<{
  readonly message: string
}> {
  static fromConfigError(cause: { readonly message: string }) {
    return new ContentBuildUsageError({ message: cause.message })
  }

  static fail(message: string) {
    return Effect.fail(new ContentBuildUsageError({ message }))
  }
}

export class ContentBuildFileSystemError extends Data.TaggedError(
  'ContentBuildFileSystemError'
)<{
  readonly cause: unknown
  readonly operation: string
  readonly path: string
}> {
  override get message() {
    return `Could not ${this.operation} ${this.path}`
  }
}

export class ContentBuildParseError extends Data.TaggedError(
  'ContentBuildParseError'
)<{
  readonly cause: unknown
  readonly context: string
  readonly message: string
}> {}
