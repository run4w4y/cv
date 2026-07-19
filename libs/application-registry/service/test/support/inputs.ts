import type { UpsertApplicationInput } from '../../src'

export const recordedAt = '2026-07-12T12:00:00.000Z'

export const makeApplicationInput = (
  suffix: string
): UpsertApplicationInput => ({
  canonicalUrl: `https://example.test/jobs/${suffix}`,
  company: 'Service Integration',
  jobKey: `service:${suffix}`,
  labels: ['seed'],
  location: 'Remote',
  role: 'Effect Engineer',
  source: 'service-integration',
  sourceJobId: null,
  targetStage: 'apply_next',
})
