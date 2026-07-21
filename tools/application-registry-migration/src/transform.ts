import { createHash } from 'node:crypto'
import { Effect } from 'effect'

import {
  migrationError,
  migrationFailure,
  RegistryMigrationError,
} from './errors'
import type { TableSpec } from './manifest'

export type RegistryRow = Readonly<Record<string, unknown>>
export type NormalizedRegistry = ReadonlyMap<string, readonly RegistryRow[]>

const normalizeTimestamp = (
  table: string,
  column: string,
  value: unknown,
  source: 'd1' | 'postgres'
): string | null => {
  if (value === null) return null
  if (!(typeof value === 'string' || value instanceof Date)) {
    throw migrationFailure(
      'normalize timestamp',
      `${table}.${column} is not a timestamp string.`
    )
  }

  if (
    source === 'd1' &&
    (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value))
  ) {
    throw migrationFailure(
      'normalize timestamp',
      `${table}.${column} is not a canonical UTC ISO timestamp.`
    )
  }

  const instant = new Date(value)
  if (Number.isNaN(instant.getTime())) {
    throw migrationFailure(
      'normalize timestamp',
      `${table}.${column} contains an invalid timestamp.`
    )
  }
  const canonical = instant.toISOString()
  if (source === 'd1' && canonical !== value) {
    throw migrationFailure(
      'normalize timestamp',
      `${table}.${column} does not round-trip as a canonical UTC instant.`
    )
  }
  return canonical
}

const normalizeBoolean = (
  table: string,
  column: string,
  value: unknown,
  source: 'd1' | 'postgres'
): boolean | null => {
  if (value === null) return null
  if (source === 'd1') {
    if (value === 0) return false
    if (value === 1) return true
  } else if (typeof value === 'boolean') {
    return value
  }

  throw migrationFailure(
    'normalize boolean',
    `${table}.${column} is not a strict ${source === 'd1' ? '0/1' : 'boolean'} value.`
  )
}

const normalizeBigintNumber = (
  table: string,
  column: string,
  value: unknown,
  source: 'd1' | 'postgres'
): number | null => {
  if (value === null) return null

  if (typeof value === 'number') {
    if (Number.isSafeInteger(value)) return value
  } else if (
    source === 'postgres' &&
    typeof value === 'string' &&
    /^-?(?:0|[1-9]\d*)$/u.test(value)
  ) {
    const parsed = Number(value)
    if (Number.isSafeInteger(parsed) && parsed.toString() === value) {
      return parsed
    }
  }

  throw migrationFailure(
    'normalize bigint',
    `${table}.${column} is not a safe ${source === 'd1' ? 'integer' : 'PostgreSQL bigint'} value.`
  )
}

const normalizeJson = (
  table: string,
  column: string,
  value: unknown,
  source: 'd1' | 'postgres'
): unknown => {
  if (value === null) return null
  if (source === 'postgres') return value
  if (typeof value !== 'string') {
    throw migrationFailure(
      'normalize JSON',
      `${table}.${column} is not D1 JSON text.`
    )
  }

  try {
    const parsed: unknown = JSON.parse(value)
    validateLosslessJson(value, table, column)
    return parsed
  } catch (cause) {
    if (cause instanceof RegistryMigrationError) throw cause
    throw migrationError(
      'normalize JSON',
      `${table}.${column} contains malformed JSON.`
    )(cause)
  }
}

const jsonNumberPattern = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u

const canonicalDecimal = (token: string): string => {
  const match =
    /^(?<sign>-?)(?<integer>0|[1-9]\d*)(?:\.(?<fraction>\d+))?(?:[eE](?<exponent>[+-]?\d+))?$/u.exec(
      token
    )
  if (match?.groups === undefined) {
    throw new Error(`Invalid JSON number token ${token}.`)
  }

  const sign = match.groups.sign
  const integer = match.groups.integer
  const fraction = match.groups.fraction ?? ''
  const explicitExponent = Number.parseInt(match.groups.exponent ?? '0', 10)
  let digits = `${integer}${fraction}`.replace(/^0+/u, '')
  if (digits.length === 0) return '0e0'

  let exponent = explicitExponent - fraction.length
  const trailingZeroCount = /0+$/u.exec(digits)?.[0].length ?? 0
  if (trailingZeroCount > 0) {
    digits = digits.slice(0, -trailingZeroCount)
    exponent += trailingZeroCount
  }
  return `${sign}${digits}e${exponent}`
}

const validateLosslessNumber = (
  token: string,
  table: string,
  column: string
): void => {
  const value = Number(token)
  if (
    !Number.isFinite(value) ||
    (Number.isInteger(value) && !Number.isSafeInteger(value)) ||
    canonicalDecimal(token) !== canonicalDecimal(value.toString())
  ) {
    throw migrationFailure(
      'normalize JSON',
      `${table}.${column} contains a JSON number that cannot round-trip losslessly through JavaScript.`
    )
  }
}

/**
 * Validates the two JSON shapes that PostgreSQL `jsonb` and JavaScript would
 * otherwise alter silently: duplicate object keys and imprecise numbers.
 * `JSON.parse` has already established the document grammar before this runs.
 */
const validateLosslessJson = (
  input: string,
  table: string,
  column: string
): void => {
  let offset = 0

  const skipWhitespace = (): void => {
    while (/\s/u.test(input[offset] ?? '')) offset += 1
  }

  const readString = (): string => {
    const start = offset
    offset += 1
    while (offset < input.length) {
      const character = input[offset]
      if (character === '\\') {
        offset += 2
        continue
      }
      offset += 1
      if (character === '"') {
        return JSON.parse(input.slice(start, offset)) as string
      }
    }
    throw new Error('Unterminated JSON string.')
  }

  const readValue = (): void => {
    skipWhitespace()
    const character = input[offset]
    if (character === '{') {
      offset += 1
      skipWhitespace()
      const keys = new Set<string>()
      if (input[offset] === '}') {
        offset += 1
        return
      }
      while (offset < input.length) {
        skipWhitespace()
        const key = readString()
        if (keys.has(key)) {
          throw migrationFailure(
            'normalize JSON',
            `${table}.${column} contains duplicate JSON object key ${JSON.stringify(key)}.`
          )
        }
        keys.add(key)
        skipWhitespace()
        offset += 1 // colon; JSON.parse already validated the grammar
        readValue()
        skipWhitespace()
        const separator = input[offset]
        offset += 1
        if (separator === '}') return
      }
      return
    }

    if (character === '[') {
      offset += 1
      skipWhitespace()
      if (input[offset] === ']') {
        offset += 1
        return
      }
      while (offset < input.length) {
        readValue()
        skipWhitespace()
        const separator = input[offset]
        offset += 1
        if (separator === ']') return
      }
      return
    }

    if (character === '"') {
      readString()
      return
    }

    for (const literal of ['true', 'false', 'null']) {
      if (input.startsWith(literal, offset)) {
        offset += literal.length
        return
      }
    }

    const number = jsonNumberPattern.exec(input.slice(offset))?.[0]
    if (number === undefined) throw new Error('Invalid JSON value.')
    validateLosslessNumber(number, table, column)
    offset += number.length
  }

  readValue()
  skipWhitespace()
  if (offset !== input.length) throw new Error('Unexpected trailing JSON data.')
}

export const normalizeRow = (
  spec: TableSpec,
  row: RegistryRow,
  source: 'd1' | 'postgres'
): Effect.Effect<RegistryRow, ReturnType<typeof migrationFailure>> =>
  Effect.try({
    try: () => {
      const normalized: Record<string, unknown> = {}
      const timestampColumns = new Set(spec.timestamps ?? [])
      const booleanColumns = new Set(spec.booleans ?? [])
      const bigintNumberColumns = new Set(spec.bigintNumbers ?? [])
      const jsonColumns = new Set(spec.json ?? [])

      for (const column of spec.columns) {
        const value = row[column]
        if (value === undefined) {
          throw migrationFailure(
            'normalize row',
            `${spec.name} is missing required column ${column}.`
          )
        }

        normalized[column] = timestampColumns.has(column)
          ? normalizeTimestamp(spec.name, column, value, source)
          : booleanColumns.has(column)
            ? normalizeBoolean(spec.name, column, value, source)
            : bigintNumberColumns.has(column)
              ? normalizeBigintNumber(spec.name, column, value, source)
              : jsonColumns.has(column)
                ? normalizeJson(spec.name, column, value, source)
                : value
      }

      for (const key of spec.primaryKey) {
        if (normalized[key] === null || normalized[key] === undefined) {
          throw migrationFailure(
            'normalize row',
            `${spec.name} contains a null primary-key component ${key}.`
          )
        }
      }

      return normalized
    },
    catch: (cause) =>
      cause instanceof RegistryMigrationError
        ? cause
        : migrationError(
            'normalize row',
            `Could not normalize a row from ${spec.name}.`
          )(cause),
  })

const canonicalize = (value: unknown): unknown => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(canonicalize)
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    )
  }
  throw migrationFailure(
    'canonicalize row',
    `Unsupported value type ${typeof value} in migration data.`
  )
}

const primaryKey = (spec: TableSpec, row: RegistryRow): string =>
  JSON.stringify(spec.primaryKey.map((column) => canonicalize(row[column])))

export const tableDigest = (
  spec: TableSpec,
  rows: readonly RegistryRow[]
): string => {
  const canonicalRows = rows
    .toSorted((left, right) =>
      primaryKey(spec, left).localeCompare(primaryKey(spec, right))
    )
    .map((row) => canonicalize(row))

  return createHash('sha256')
    .update(JSON.stringify(canonicalRows))
    .digest('hex')
}
