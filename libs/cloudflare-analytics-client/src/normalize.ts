import {
  type AnalyticsDashboardData,
  createEmptyAnalyticsDashboardData,
  sanitizeAnalyticsInput,
} from '@cv/analytics-core'
import * as Effect from 'effect/Effect'
import { isPlainObject } from 'es-toolkit/predicate'

import { NormalizeError } from './errors'
import { readArray, readRecord, readString } from './guards'
import type { Range } from './types'

export const createEmptyData = () => createEmptyAnalyticsDashboardData()

const extractZoneRows = (payload: unknown, key: 'dailyPaths' | 'topPaths') => {
  if (!isPlainObject(payload)) {
    return []
  }

  const data = readRecord(payload, 'data')
  const viewer = data ? readRecord(data, 'viewer') : undefined
  const zones = viewer ? readArray(viewer, 'zones') : []

  return zones.flatMap((zone) => {
    if (!isPlainObject(zone)) {
      return []
    }

    return readArray(zone, key).filter(isPlainObject)
  })
}

export const extractGraphqlErrors = (payload: unknown) => {
  if (!isPlainObject(payload)) {
    return []
  }

  return readArray(payload, 'errors')
    .map((error) =>
      isPlainObject(error) ? readString(error, 'message') : undefined
    )
    .filter((message): message is string => Boolean(message))
}

const extractAnalyticsRows = (payload: unknown) => {
  const dailyRows = extractZoneRows(payload, 'dailyPaths')
  const topRows = extractZoneRows(payload, 'topPaths')

  return dailyRows.length > 0 ? dailyRows : topRows
}

export const normalizeResponses = (
  payloads: readonly unknown[],
  range: Range
) =>
  Effect.try({
    try: () => {
      const rows = payloads.flatMap(extractAnalyticsRows)

      return sanitizeAnalyticsInput(rows, {
        from: range.from,
        to: range.to,
      }) satisfies AnalyticsDashboardData
    },
    catch: (cause) =>
      NormalizeError.fromCause({
        cause,
        message: 'Cloudflare analytics response could not be sanitized',
      }),
  })

export const normalizeResponse = (payload: unknown, range: Range) =>
  normalizeResponses([payload], range)
