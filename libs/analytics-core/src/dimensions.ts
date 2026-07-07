import { isPlainObject } from 'es-toolkit/predicate'
import { assertSafeString, isUnsafeDimensionValue } from './privacy'
import { maybeString } from './record'
import type { AnalyticsDimensionCounts } from './types'

export const readDimension = (
  record: Record<string, unknown>,
  names: string[]
): string | undefined => {
  for (const name of names) {
    const direct = maybeString(record[name])

    if (direct) {
      return direct
    }
  }

  const dimensions = isPlainObject(record.dimensions) ? record.dimensions : null

  if (!dimensions) {
    return undefined
  }

  for (const name of names) {
    const value = maybeString(dimensions[name])

    if (value) {
      return value
    }
  }

  return undefined
}

export const incrementDimension = (
  counts: AnalyticsDimensionCounts,
  value: string | undefined,
  amount: number
) => {
  if (!value) {
    return
  }

  if (isUnsafeDimensionValue(value)) {
    return
  }

  const normalized = value
    .replace(/^https?:\/\//iu, '')
    .split(/[/?#]/u)[0]
    ?.trim()

  if (!normalized || normalized.length > 80) {
    return
  }

  assertSafeString(normalized, 'dimension')
  counts[normalized] = (counts[normalized] ?? 0) + amount
}

export const sortDimensionCounts = (counts: AnalyticsDimensionCounts) =>
  Object.fromEntries(
    Object.entries(counts).sort(
      ([leftKey, leftValue], [rightKey, rightValue]) =>
        rightValue - leftValue || leftKey.localeCompare(rightKey)
    )
  )
