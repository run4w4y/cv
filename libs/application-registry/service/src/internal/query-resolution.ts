import type {
  AnyQueryDefinition,
  QueryError,
  QueryErrorCode,
} from '@cv/drizzle-query'
import { resolveQuery } from '@cv/drizzle-query-effect'
import { Effect } from 'effect'

import { RegistryBadRequestError } from '../errors'

const requestErrorCodes = new Set<QueryErrorCode>([
  'cursor-mismatch',
  'invalid-cursor',
  'invalid-pagination',
])

const queryFailure = (
  error: QueryError
): Effect.Effect<never, RegistryBadRequestError> =>
  requestErrorCodes.has(error.code)
    ? Effect.fail(
        new RegistryBadRequestError({ message: 'Invalid pagination cursor.' })
      )
    : Effect.die(error)

/** Resolves one decoded registry query and exposes only request-owned errors. */
export const resolveRegistryQuery = <Definition extends AnyQueryDefinition>(
  definition: Definition,
  ...arguments_: Parameters<Definition['resolve']>
): Effect.Effect<ReturnType<Definition['resolve']>, RegistryBadRequestError> =>
  resolveQuery(definition, ...arguments_).pipe(Effect.catch(queryFailure))
