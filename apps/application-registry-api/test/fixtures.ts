import type { CreateApplicationRequest } from '@cv/application-registry-api-contract'

export const applicationInput = {
  applicationStatus: 'not_started',
  appliedAt: null,
  company: 'Example Company',
  compensations: [
    {
      currencyCode: 'JPY',
      kind: 'base_salary',
      maximumMinor: 15_000_000,
      minimumMinor: 10_000_000,
      period: 'year',
      rawText: 'JPY 10m–15m',
      source: 'e2e',
    },
  ],
  followUpAt: null,
  labels: ['e2e', 'remote'],
  location: 'Tokyo or remote',
  personalPriority: 'high',
  postingUrl: 'https://example.com/jobs/e2e-registry',
  role: 'Integration Engineer',
  targetStage: 'apply_next',
} satisfies CreateApplicationRequest
