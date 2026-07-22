import { Result } from 'effect'

import { isJsonValue } from './inspection/json-value'
import type { RawJsonFormatResult, RawJsonResult } from './types'

const parse = (source: string): unknown => JSON.parse(source)

export const parseRawJson = (source: string): RawJsonResult => {
  const result = Result.try({
    try: () => parse(source),
    catch: (cause) =>
      cause instanceof Error ? cause.message : 'The value is not valid JSON.',
  })

  if (Result.isFailure(result)) {
    return { valid: false, message: result.failure }
  }
  return isJsonValue(result.success)
    ? { valid: true, value: result.success }
    : { valid: false, message: 'The parsed value is not JSON-compatible.' }
}

export const formatRawJson = (value: unknown): RawJsonFormatResult => {
  if (!isJsonValue(value)) {
    return {
      valid: false,
      message: 'The current value cannot be represented as JSON.',
    }
  }
  const result = Result.try(() => JSON.stringify(value, null, 2))
  return Result.isSuccess(result) && result.success !== undefined
    ? { valid: true, source: result.success }
    : {
        valid: false,
        message: 'The current value could not be formatted as JSON.',
      }
}
