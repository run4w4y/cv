import { Result, Schema, SchemaIssue } from 'effect'

import { toJsonPointer } from './json-pointer'
import type { ValidationIssue, ValidationResult } from './types'

type FormattedPathSegment = PropertyKey | { readonly key: PropertyKey }

const pathKey = (segment: FormattedPathSegment): PropertyKey =>
  typeof segment === 'object' ? segment.key : segment

const normalizePath = (
  path: ReadonlyArray<FormattedPathSegment> | undefined
): ReadonlyArray<string | number> =>
  (path ?? []).map((segment) => {
    const key = pathKey(segment)
    return typeof key === 'number' ? key : String(key)
  })

const formatter = SchemaIssue.makeFormatterStandardSchemaV1()

export const validateSchemaValue = <
  S extends Schema.ConstraintDecoder<unknown>,
>(
  schema: S,
  value: unknown
): ValidationResult<S['Type']> => {
  const result = Schema.decodeUnknownResult(schema, {
    errors: 'all',
    onExcessProperty: 'error',
  })(value)

  if (Result.isSuccess(result)) {
    return { valid: true, value: result.success, issues: [] }
  }

  const formatted = formatter(result.failure.issue)
  return {
    valid: false,
    issues: formatted.issues.map((issue): ValidationIssue => {
      const path = normalizePath(issue.path)
      return {
        pointer: toJsonPointer(path),
        path,
        message: issue.message,
      }
    }),
  }
}

export const issuesByPointer = (
  issues: ReadonlyArray<ValidationIssue>
): ReadonlyMap<string, ReadonlyArray<ValidationIssue>> => {
  const grouped = new Map<string, Array<ValidationIssue>>()
  for (const issue of issues) {
    const existing = grouped.get(issue.pointer)
    if (existing) existing.push(issue)
    else grouped.set(issue.pointer, [issue])
  }
  return grouped
}
