import type { Configuration, GraphqlVariables, Range } from './types'

export const buildQuery = () => `
query AudienceAnalytics($zoneTag: string, $filter: filter) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      topPaths: httpRequestsAdaptiveGroups(
        filter: $filter
        limit: 1000
        orderBy: [sum_visits_DESC]
      ) {
        count
        sum {
          visits
        }
        dimensions {
          clientRequestPath
        }
      }
      dailyPaths: httpRequestsAdaptiveGroups(
        filter: $filter
        limit: 5000
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
  range: Range,
  pathLike?: string
): GraphqlVariables => {
  const host = range.host ?? configuration.host
  const normalizedPathLike = pathLike?.trim()

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
        ...(host ? [{ clientRequestHTTPHost: host }] : []),
        ...(normalizedPathLike
          ? [{ clientRequestPath_like: normalizedPathLike }]
          : []),
      ],
    },
    zoneTag: configuration.zoneId,
  }
}
