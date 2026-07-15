import { QueryError } from '../../../error'
import { equalityOperators } from './shared'
import type { EnumOperators } from './types'

/**
 * Creates equality and membership operators whose request values are inferred
 * from a literal string-enum tuple.
 */
export const enumOperators = <const Values extends readonly string[]>(
  values: Values
): EnumOperators<Values[number]> => {
  if (values.length === 0) {
    throw new QueryError(
      'invalid-definition',
      'An enum filter must contain at least one value.',
      { path: 'enumValues' }
    )
  }
  const uniqueValues = new Set(values)
  if (uniqueValues.size !== values.length) {
    throw new QueryError(
      'invalid-definition',
      'Enum filter values must be unique.',
      { path: 'enumValues' }
    )
  }
  return equalityOperators<Values[number]>()
}
