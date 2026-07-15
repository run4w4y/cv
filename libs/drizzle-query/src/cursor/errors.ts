import { QueryError } from '../error'

export const cursorError = (
  code: 'invalid-cursor' | 'cursor-mismatch',
  message: string,
  path?: string,
  cause?: unknown
): QueryError =>
  new QueryError(code, message, {
    ...(path === undefined ? {} : { path }),
    ...(cause === undefined ? {} : { cause }),
  })
