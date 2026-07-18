import { Result } from 'effect'

import type { RawJsonResult } from './types'

const parse = (source: string): unknown => JSON.parse(source)

export const parseRawJson = (source: string): RawJsonResult => {
  const result = Result.try({
    try: () => parse(source),
    catch: (cause) =>
      cause instanceof Error ? cause.message : 'The value is not valid JSON.',
  })

  return Result.isSuccess(result)
    ? { valid: true, value: result.success }
    : { valid: false, message: result.failure }
}

export const formatRawJson = (value: unknown): string => {
  const result = Result.try(() => JSON.stringify(value, null, 2))
  return Result.isSuccess(result) ? (result.success ?? 'null') : 'null'
}
