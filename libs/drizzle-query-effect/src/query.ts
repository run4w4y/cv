import type {
  AnyQueryDefinition,
  FinalizedPage,
  PaginationPageInfo,
} from '@cv/drizzle-query'
import { QueryError } from '@cv/drizzle-query'
import { Effect } from 'effect'

/**
 * Structural finalization contract shared by ordinary select and relational
 * query views. It intentionally does not depend on either concrete core class.
 */
export interface FinalizableQuery<Row, Info extends PaginationPageInfo> {
  readonly finalize: (
    rows: readonly Row[],
    totalItems?: number
  ) => FinalizedPage<Row, Info>
}

const queryFailure = (cause: unknown): QueryError => {
  if (cause instanceof QueryError) return cause
  throw cause
}

/**
 * Resolves a decoded query request while translating only core
 * {@link QueryError}s into the Effect error channel.
 */
export const resolveQuery = <Definition extends AnyQueryDefinition>(
  definition: Definition,
  ...arguments_: Parameters<Definition['resolve']>
): Effect.Effect<ReturnType<Definition['resolve']>, QueryError> =>
  Effect.try({
    try: () =>
      definition.resolve(...arguments_) as ReturnType<Definition['resolve']>,
    catch: queryFailure,
  })

/**
 * Finalizes rows returned by an applied resolved query and translates only
 * core {@link QueryError}s into the Effect error channel.
 */
export const finalizeQuery = <Row, Info extends PaginationPageInfo>(
  query: FinalizableQuery<NoInfer<Row>, Info>,
  rows: readonly Row[],
  totalItems?: number
): Effect.Effect<FinalizedPage<Row, Info>, QueryError> =>
  Effect.try({
    try: () => query.finalize(rows, totalItems),
    catch: queryFailure,
  })
