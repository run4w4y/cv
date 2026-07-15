/** Stable categories for errors raised while defining or compiling a query. */
export type QueryErrorCode =
  | 'invalid-definition'
  | 'invalid-filter'
  | 'invalid-ordering'
  | 'invalid-pagination'
  | 'invalid-cursor'
  | 'cursor-mismatch'

/** Additional location and causal context attached to a {@link QueryError}. */
export type QueryErrorOptions = {
  readonly path?: string
  readonly cause?: unknown
}

/**
 * Error produced when a package-owned definition, ordering, pagination, or
 * cursor invariant cannot be satisfied.
 *
 * Transport decoding and request-shape validation remain the consumer's
 * responsibility. The core throws synchronously so an application can map this
 * class into its own error abstraction without introducing a runtime dependency.
 */
export class QueryError extends Error {
  readonly code: QueryErrorCode
  readonly path: string | undefined

  constructor(
    code: QueryErrorCode,
    message: string,
    options: QueryErrorOptions = {}
  ) {
    super(
      message,
      options.cause === undefined ? undefined : { cause: options.cause }
    )
    this.name = 'QueryError'
    this.code = code
    this.path = options.path
  }
}
