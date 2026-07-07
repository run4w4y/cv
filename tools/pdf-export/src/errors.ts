import { Data, Effect } from 'effect'

export class PdfUsageError extends Data.TaggedError('PdfUsageError')<{
  readonly message: string
}> {
  static fromConfigError(cause: { readonly message: string }) {
    return new PdfUsageError({ message: cause.message })
  }

  static fail(message: string) {
    return Effect.fail(new PdfUsageError({ message }))
  }
}

export class PdfFileSystemError extends Data.TaggedError('PdfFileSystemError')<{
  readonly message: string
  readonly operation: string
  readonly path: string
  readonly cause: unknown
}> {}

export class PdfProcessError extends Data.TaggedError('PdfProcessError')<{
  readonly message: string
  readonly command?: string
  readonly cause: unknown
}> {}

export class PdfNetworkError extends Data.TaggedError('PdfNetworkError')<{
  readonly message: string
  readonly url: string
  readonly cause?: unknown
}> {}
