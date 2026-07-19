import { makeRegistryFactory } from '@cv/worker-test-kit/application-registry'

const factory = makeRegistryFactory({
  now: '2026-07-10T12:00:00.000Z',
  seed: 7_100,
})

export const applicationInput = factory.application({
  applicationStatus: 'not_started',
  appliedAt: null,
  canonicalUrl: 'https://example.com/jobs/e2e-registry',
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
  jobKey: 'url:https://example.com/jobs/e2e-registry',
  labels: ['e2e', 'remote'],
  lastContactAt: null,
  location: 'Tokyo or remote',
  personalPriority: 'high',
  role: 'Integration Engineer',
  source: 'e2e',
  sourceJobId: null,
  targetStage: 'apply_next',
})
