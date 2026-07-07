import type {
  CloudflareAnalyticsConfig,
  CloudflareAnalyticsRange,
  GraphqlVariables,
} from './types'

export const buildCloudflareAnalyticsQuery = () => `
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

export const buildCloudflareAnalyticsVariables = (
  config: CloudflareAnalyticsConfig,
  range: CloudflareAnalyticsRange
): GraphqlVariables => {
  const host = range.host ?? config.host

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
      ],
    },
    zoneTag: config.zoneId,
  }
}
