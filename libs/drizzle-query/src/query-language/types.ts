/** Stable error codes emitted by the compact query-language codecs. */
export type QueryLanguageIssueCode =
  | 'duplicate-field'
  | 'duplicate-sort-field'
  | 'empty-expression'
  | 'expression-too-deep'
  | 'expression-too-large'
  | 'expected-token'
  | 'invalid-literal'
  | 'invalid-sort-direction'
  | 'invalid-sort-null-placement'
  | 'too-many-nodes'
  | 'too-many-sort-terms'
  | 'unexpected-token'
  | 'unsupported-value'

/** One precise syntax/formatting problem in a compact query expression. */
export type QueryLanguageIssue = {
  readonly code: QueryLanguageIssueCode
  readonly message: string
  /** Zero-based character offset when the issue originated while parsing. */
  readonly offset?: number
}

/** Explicit result returned at untrusted compact query boundaries. */
export type QueryLanguageResult<Value> =
  | { readonly ok: true; readonly value: Value }
  | {
      readonly ok: false
      readonly issues: readonly [QueryLanguageIssue, ...QueryLanguageIssue[]]
    }

export const queryLanguageSuccess = <Value>(
  value: Value
): QueryLanguageResult<Value> => ({ ok: true, value })

export const queryLanguageFailure = <Value = never>(
  issue: QueryLanguageIssue
): QueryLanguageResult<Value> => ({ ok: false, issues: [issue] })
