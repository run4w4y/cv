import { Effect } from 'effect'

import { RegistryQueryTooComplexError } from '../errors'

export const d1MaxBoundParameters = 100

type CompilableQuery = {
  readonly toSQL: () => { readonly params: readonly unknown[] }
}

/** Rejects a compiled D1 query before it can surface as an opaque database 500. */
export const enforceD1ParameterBudget = (
  query: CompilableQuery,
  operation: string
): Effect.Effect<void, RegistryQueryTooComplexError> => {
  const parameterCount = query.toSQL().params.length
  return parameterCount <= d1MaxBoundParameters
    ? Effect.void
    : Effect.fail(
        new RegistryQueryTooComplexError({
          maxParameters: d1MaxBoundParameters,
          message: `${operation} is too complex: it requires ${parameterCount} bound parameters, but D1 accepts at most ${d1MaxBoundParameters}.`,
          parameterCount,
        })
      )
}
