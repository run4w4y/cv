import * as Redacted from 'effect/Redacted'

import type { CloudflareAnalyticsConfig } from './types'

export const testConfig = {
  apiToken: Redacted.make('secret-token'),
  endpoint: 'https://cloudflare.test/graphql',
  host: 'cv.example.test',
  zoneId: 'zone-123',
} satisfies CloudflareAnalyticsConfig

export const cloudflarePayload = {
  data: {
    viewer: {
      zones: [
        {
          dailyPaths: [
            {
              count: 4,
              dimensions: {
                clientCountryName: 'Germany',
                clientRequestPath:
                  '/en/a/frontend-alpha/?p=AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA',
                datetimeDay: '2026-06-17',
              },
              sum: {
                visits: 3,
              },
              uniq: {
                uniques: 2,
              },
            },
            {
              count: 8,
              dimensions: {
                clientCountryName: 'Netherlands',
                clientRequestPath: '/en/',
                datetimeDay: '2026-06-18',
              },
              sum: {
                visits: 5,
              },
              uniq: {
                uniques: 4,
              },
            },
          ],
          topPaths: [
            {
              count: 999,
              dimensions: {
                clientRequestPath: '/en/a/frontend-alpha/',
              },
              sum: {
                visits: 999,
              },
              uniq: {
                uniques: 999,
              },
            },
          ],
        },
      ],
    },
  },
}
