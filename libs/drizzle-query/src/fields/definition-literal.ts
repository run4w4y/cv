import { is, isSQLWrapper, Param, type SQLWrapper, sql } from 'drizzle-orm'

import type { SortRuntime } from './runtime'

const isInlineSafeString = (value: string): boolean => {
  for (const character of value) {
    const codePoint = character.codePointAt(0)
    if (character === '\\' || codePoint === undefined || codePoint <= 31) {
      return false
    }
    if (codePoint === 127) return false
  }
  return true
}

const isInlineSafeDefinitionValue = (value: unknown): boolean =>
  value === null ||
  typeof value === 'boolean' ||
  typeof value === 'bigint' ||
  (typeof value === 'number' && Number.isFinite(value)) ||
  (typeof value === 'string' && isInlineSafeString(value))

/** Compiles a definition-owned value without binding safe static literals. */
export const compileDefinitionLiteral = (
  sort: SortRuntime,
  value: string
): SQLWrapper => {
  const encoded = sort.encode?.(value) ?? value
  if (is(encoded, Param)) {
    if (isSQLWrapper(encoded.value)) return encoded

    const driverValue = encoded.encoder.mapToDriverValue(encoded.value)
    return isInlineSafeDefinitionValue(driverValue)
      ? sql`${encoded}`.inlineParams()
      : encoded
  }
  if (isSQLWrapper(encoded)) return encoded

  // Drizzle's MySQL dialect doubles quotes when inlining strings, but it does
  // not escape backslashes. Keep those values and control bytes bound.
  return isInlineSafeDefinitionValue(encoded)
    ? sql`${encoded}`.inlineParams()
    : sql.param(encoded)
}

/** Emits a static enum rank without consuming the request parameter budget. */
export const compileDefinitionRank = (value: number): SQLWrapper =>
  sql`${value}`.inlineParams()
