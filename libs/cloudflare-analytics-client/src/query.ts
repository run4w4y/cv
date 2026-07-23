import type { Configuration, GraphqlVariables, Range } from './types'

export const limitsQuery = `
query AnalyticsLimits($zoneTag: string) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      settings {
        httpRequestsAdaptiveGroups {
          enabled
          maxDuration
          maxPageSize
          notOlderThan
        }
      }
    }
  }
}
`

export const buildLimitsVariables = (configuration: Configuration) => ({
  zoneTag: configuration.zoneId,
})

export const buildQuery = (maxPageSize: number) => `
query AliasedPathAnalytics($zoneTag: string, $filter: filter) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      dailyPaths: httpRequestsAdaptiveGroups(
        filter: $filter
        limit: ${maxPageSize}
        orderBy: [date_ASC]
      ) {
        count
        sum {
          visits
        }
        dimensions {
          clientRequestPath
          datetimeDay: date
          clientCountryName
        }
      }
    }
  }
}
`

export const buildVariables = (
  configuration: Configuration,
  range: Range
): GraphqlVariables => {
  return {
    filter: {
      AND: [
        {
          datetime_geq: range.from,
          datetime_lt: range.to,
        },
        {
          requestSource: 'eyeball',
        },
        {
          clientRequestHTTPHost: configuration.host,
        },
        {
          clientRequestPath_like: '/c/%',
        },
      ],
    },
    zoneTag: configuration.zoneId,
  }
}
