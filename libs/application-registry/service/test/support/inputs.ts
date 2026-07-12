import type {
  CreateCampaignCaptureInput,
  UpsertApplicationInput,
} from '../../src'

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

const submissionDetails = {
  additionalInstructions: null,
  applicationMethod: 'web form',
  applicationQuestions: [],
  applicationUrl: 'https://example.test/apply',
  contactEmail: null,
  coverLetterInstructions: null,
  deadline: null,
  employmentType: 'full-time',
  languageRequirements: ['English'],
  locationRestrictions: null,
  relocation: null,
  requiredDocuments: ['CV'],
  salary: null,
  visaRequirements: null,
  workMode: 'remote',
} as const

export const makeCaptureInput = (
  suffix: string,
  operationId: string
): CreateCampaignCaptureInput => ({
  ...makeApplicationInput(suffix),
  artifacts: [],
  audience: null,
  campaignRunId: `service-run-${suffix}`,
  capturedAt: recordedAt,
  confidence: 0.9,
  deviceId: 'miniflare',
  jobContentHash: null,
  operationId,
  profile: 'default',
  submissionDetails,
})
