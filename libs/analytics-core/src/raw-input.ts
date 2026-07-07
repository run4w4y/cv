import { isPlainObject } from 'es-toolkit/predicate'
import { readDimension } from './dimensions'

const suspiciousKeyPattern =
  /(token|query|href|url|user.?agent|ip|email|raw|cookie|authorization)/iu

export const readPathFromRecord = (record: Record<string, unknown>) =>
  readDimension(record, [
    'clientRequestPath',
    'path',
    'requestPath',
    'pagePath',
    'metric',
  ])

export const readDateFromRecord = (record: Record<string, unknown>) =>
  readDimension(record, ['datetimeHour', 'datetimeDay', 'date', 'at', 'bucket'])

export const flattenRawRows = (input: unknown): Record<string, unknown>[] => {
  if (Array.isArray(input)) {
    return input.flatMap(flattenRawRows)
  }

  if (!isPlainObject(input)) {
    return []
  }

  const rows: Record<string, unknown>[] = []

  if (readPathFromRecord(input)) {
    rows.push(input)
    return rows
  }

  for (const [key, value] of Object.entries(input)) {
    if (suspiciousKeyPattern.test(key) && typeof value === 'string') {
      continue
    }

    if (Array.isArray(value) || isPlainObject(value)) {
      rows.push(...flattenRawRows(value))
    }
  }

  return rows
}
