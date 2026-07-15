import { QueryError } from '../error'
import type { OrderingErrorKind } from './types'

export const invalidOrdering = (
  message: string,
  path: string,
  kind: OrderingErrorKind = 'request',
  cause?: unknown
): QueryError =>
  new QueryError(
    kind === 'definition' ? 'invalid-definition' : 'invalid-ordering',
    message,
    {
      path,
      ...(cause === undefined ? {} : { cause }),
    }
  )
