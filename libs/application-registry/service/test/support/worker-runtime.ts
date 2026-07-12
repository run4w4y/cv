import type { D1Database } from '@cloudflare/workers-types'
import {
  RegistryCrudD1Live,
  registryDatabaseD1Layer,
} from '@cv/application-registry-crud/d1'
import { FxRates } from '@cv/application-registry-fx'
import { Effect, Layer } from 'effect'

import type {
  CreateCampaignCaptureInput,
  UpsertApplicationInput,
} from '../../src'
import { RegistryIdsLive, RegistryServicesLive } from '../../src/live'

export type RegistryServiceTestEnv = {
  readonly APPLICATION_REGISTRY_DB: D1Database
}

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

const FakeFxRatesLive = Layer.succeed(FxRates, {
  get: (baseCurrency, quoteCurrency) =>
    Effect.succeed({
      baseCurrency,
      fetchedAt: recordedAt,
      observedAt: recordedAt,
      provider: 'service-integration',
      quoteCurrency,
      rate: 2,
    }),
})

export const registryServiceTestLayer = (database: D1Database) => {
  const crud = RegistryCrudD1Live.pipe(
    Layer.provide(registryDatabaseD1Layer(database))
  )

  return RegistryServicesLive.pipe(
    Layer.provide(crud),
    Layer.provide(RegistryIdsLive),
    Layer.provide(FakeFxRatesLive)
  )
}
