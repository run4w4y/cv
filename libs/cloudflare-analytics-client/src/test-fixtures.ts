import * as Redacted from 'effect/Redacted'

import type { Configuration } from './types'

export const testConfiguration = {
  apiToken: Redacted.make('secret-token'),
  endpoint: new URL('https://cloudflare.test/graphql'),
  host: 'cv.example.test',
  zoneId: 'zone-123',
} satisfies Configuration

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
                  '/c/frontend-alpha?p=AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA',
                datetimeDay: '2026-06-17',
              },
              sum: {
                visits: 3,
              },
            },
            {
              count: 8,
              dimensions: {
                clientCountryName: 'Netherlands',
                clientRequestPath: '/c/home',
                datetimeDay: '2026-06-18',
              },
              sum: {
                visits: 5,
              },
            },
          ],
        },
      ],
    },
  },
  errors: null,
}
