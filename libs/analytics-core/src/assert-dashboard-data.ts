import { isPlainObject } from 'es-toolkit/predicate'
import { ANALYTICS_DASHBOARD_SCHEMA } from './constants'
import { normalizeAnalyticsPath } from './path'
import { hasPrivateContentToken, hasRawPersonalIdentifier } from './privacy'
import type { AnalyticsDashboardData } from './types'

export const assertAnalyticsDashboardData = (
  value: unknown
): AnalyticsDashboardData => {
  if (!isPlainObject(value)) {
    throw new Error('Analytics dashboard data must be an object')
  }

  if (value.schema !== ANALYTICS_DASHBOARD_SCHEMA) {
    throw new Error(
      `Analytics dashboard data schema must be ${ANALYTICS_DASHBOARD_SCHEMA}`
    )
  }

  if (value.version !== 2) {
    throw new Error('Analytics dashboard data version must be 2')
  }

  const serialized = JSON.stringify(value)

  if (hasPrivateContentToken(serialized)) {
    throw new Error('Analytics dashboard data contains a private content token')
  }

  if (hasRawPersonalIdentifier(serialized)) {
    throw new Error(
      'Analytics dashboard data contains raw personal identifiers'
    )
  }

  if (!Array.isArray(value.paths) || !Array.isArray(value.audiences)) {
    throw new Error(
      'Analytics dashboard data must contain paths and audiences arrays'
    )
  }

  for (const path of value.paths) {
    if (!isPlainObject(path)) {
      throw new Error('Analytics path rows must be objects')
    }

    normalizeAnalyticsPath(String(path.path ?? ''))
  }

  return value as AnalyticsDashboardData
}
