import { sanitizeAnalyticsInput } from './sanitize'
import type { AnalyticsDashboardData } from './types'

export const sampleAnalyticsDashboardData = () => {
  const data = sanitizeAnalyticsInput([
    {
      dimensions: {
        clientRequestPath: '/en/',
        country: 'Germany',
        datetimeDay: '2026-06-16',
        deviceType: 'desktop',
        refererHost: 'github.com',
      },
      sum: { pageViews: 18, visits: 11 },
      uniq: { visitors: 9 },
    },
    {
      dimensions: {
        clientRequestPath: '/en/a/frontend-alpha/',
        country: 'Netherlands',
        datetimeDay: '2026-06-17',
        deviceType: 'desktop',
        refererHost: 'linkedin.com',
      },
      sum: { pageViews: 6, visits: 4 },
      uniq: { visitors: 3 },
    },
    {
      dimensions: {
        clientRequestPath: '/en/a/backend-rust/',
        country: 'United States',
        datetimeDay: '2026-06-18',
        deviceType: 'mobile',
        refererHost: 'mail.google.com',
      },
      sum: { pageViews: 9, visits: 5 },
      uniq: { visitors: 4 },
    },
    {
      dimensions: {
        clientRequestPath: '/ru/a/platform-ru/',
        country: 'Serbia',
        datetimeDay: '2026-06-19',
        deviceType: 'desktop',
        refererHost: 'direct',
      },
      sum: { pageViews: 3, visits: 2 },
      uniq: { visitors: 2 },
    },
  ])

  return {
    ...data,
    audiences: data.audiences.map((audience) => ({
      ...audience,
      metadata:
        audience.audienceId === 'frontend-alpha'
          ? {
              company: 'Frontend target',
              label: 'Senior frontend slice',
              role: 'Senior Frontend Engineer',
              stage: 'Shared',
              stacks: ['React', 'TypeScript', 'Design systems'],
              variant: 'frontend',
            }
          : audience.audienceId === 'backend-rust'
            ? {
                company: 'Backend target',
                label: 'Rust backend slice',
                role: 'Backend Engineer',
                stage: 'Viewed',
                stacks: ['Rust', 'Python', 'Platform'],
                variant: 'backend',
              }
            : {
                company: 'Platform target',
                label: 'RU platform slice',
                role: 'Platform Engineer',
                stage: 'Needs follow-up',
                stacks: ['Infrastructure', 'Tooling'],
                variant: 'platform',
              },
    })),
  } satisfies AnalyticsDashboardData
}
