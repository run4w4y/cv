import { describe, expect, test } from 'bun:test'
import {
  campaignRunIdKey,
  type PreparedCampaign,
  targetArtifactManifestKey,
  targetDecisionsKey,
  targetJobKey,
  targetPreparedCampaignKey,
  WorkflowOutputs,
  workflowOutput,
} from '@cv/application-campaign'
import { Crypto, Effect } from 'effect'
import {
  type ApplicationRegistryAnalysis,
  type ApplicationRegistryCampaignCaptureRequest,
  type ApplicationRegistryCampaignClient,
  applicationRegistryAnalysisResultKey,
  applicationRegistryConflictResolutionsKey,
  applicationRegistryFitAssessmentResultKey,
  makeApplicationRegistryCampaignPlugin,
} from './index'

const unexpected = Effect.die(new Error('Unexpected registry client call'))

const client = (
  capture: ApplicationRegistryCampaignClient['capture']
): ApplicationRegistryCampaignClient => ({
  capture,
  list: () => unexpected,
  sync: () => unexpected,
})

const fitAssessment = {
  dimensions: {
    coreExperience: 21,
    hardRequirements: 34,
    practicalEligibility: 8,
    preferredSignals: 7,
    seniorityAndScope: 13,
  },
  gaps: ['The posting does not confirm every preferred platform skill.'],
  hardBlockers: [],
  rationale: 'The CV directly supports the core platform requirements.',
  rubricVersion: 'application-fit-v1',
  score: 83,
  strengths: ['Direct distributed TypeScript platform experience.'],
} as const

const recommendation: PreparedCampaign['recommendation'] = {
  coverLetter: { body: 'Letter', subject: 'Subject' },
  email: { body: 'Email', subject: 'Application' },
  followUpQuestions: [],
  job: {
    applicationQuestions: [],
    company: 'Acme',
    concerns: [],
    coverLetterInstructions: [],
    coverLetterRequired: false,
    differentiators: [],
    hiringSignals: [],
    location: '',
    niceToHaveSignals: [],
    requiredSignals: [],
    role: 'Engineer',
    routineSignals: [],
    seniority: 'Senior',
    summary: 'Build systems.',
    technologies: ['TypeScript', 'Effect'],
    workMode: 'Remote',
  },
  matchedEvidence: [],
  recommendation: {
    alternatives: [],
    audienceSlug: 'acme',
    confidence: 0.9,
    profile: 'backend',
    rationale: 'Strong fit',
  },
}

const submissionDetails = {
  additionalInstructions: null,
  applicationMethod: 'Web form',
  applicationQuestions: [],
  applicationUrl: 'https://jobs.example.com/apply',
  contactEmail: null,
  coverLetterInstructions: null,
  deadline: null,
  employmentType: 'Full-time',
  languageRequirements: ['English'],
  locationRestrictions: null,
  relocation: null,
  requiredDocuments: ['CV'],
  salary: null,
  visaRequirements: null,
  workMode: 'Remote',
}

const registryAnalysis = {
  compensations: [
    {
      currencyCode: 'USD',
      kind: 'base_salary',
      maximumMinor: 18_000_000,
      minimumMinor: 15_000_000,
      period: 'year',
      rawText: '$150k–$180k',
      source: 'job-posting',
    },
  ],
  details: {
    applyFromAbroad: 'Applications accepted from within Europe',
    countryCode: null,
    employmentType: 'Full-time',
    languageRequirements: ['English'],
    region: null,
    relocationSupport: null,
    remoteRegion: 'Europe',
    residenceRequirement: null,
    timezoneOverlap: 'Four hours with UTC',
    visaSponsorship: 'Not provided',
    workAuthorization: null,
    workMode: 'Remote within Europe',
  },
  submissionDetails,
} satisfies ApplicationRegistryAnalysis

const emptyRegistryAnalysis = {
  compensations: [],
  details: {
    applyFromAbroad: null,
    countryCode: null,
    employmentType: null,
    languageRequirements: [],
    region: null,
    relocationSupport: null,
    remoteRegion: null,
    residenceRequirement: null,
    timezoneOverlap: null,
    visaSponsorship: null,
    workAuthorization: null,
    workMode: null,
  },
  submissionDetails,
} satisfies ApplicationRegistryAnalysis

describe('application registry campaign plugin', () => {
  test('preserves target failure policy without escalating target-only failures', () => {
    const crypto = Crypto.make({
      digest: () => Effect.succeed(new Uint8Array(32)),
      randomBytes: (size) => new Uint8Array(size),
    })
    const failTarget = makeApplicationRegistryCampaignPlugin({
      client: client(() => unexpected),
      crypto,
      deviceId: null,
      failurePolicy: 'fail-target',
    })
    const failRun = makeApplicationRegistryCampaignPlugin({
      client: client(() => unexpected),
      crypto,
      deviceId: null,
      failurePolicy: 'fail-run',
    })

    expect(
      failTarget.steps
        .filter((step) => step.scope === 'run')
        .map((step) => step.failurePolicy)
    ).toEqual(['warn', 'fail-run'])
    expect(
      failTarget.steps
        .filter((step) => step.scope === 'target')
        .map((step) => step.failurePolicy)
    ).toEqual(['fail-target', 'fail-target'])
    expect(failRun.steps.map((step) => step.failurePolicy)).toEqual([
      'fail-run',
      'fail-run',
      'fail-run',
      'fail-run',
    ])
  })

  test('contributes graph steps and captures with one operation id', async () => {
    const captured: ApplicationRegistryCampaignCaptureRequest[] = []
    const crypto = Crypto.make({
      digest: () => Effect.succeed(new Uint8Array(32)),
      randomBytes: (size) => new Uint8Array(size),
    })
    const plugin = makeApplicationRegistryCampaignPlugin({
      client: client((request) =>
        Effect.sync(() => {
          captured.push(request)
          return {
            disposition: 'retry' as const,
            failure: 'offline',
            operationId: request.operationId,
            status: 'queued' as const,
          }
        })
      ),
      crypto,
      deviceId: 'desktop',
    })
    const campaign = {
      decisions: { audience: 'acme', profile: 'backend' },
      extensions: { 'application-registry': registryAnalysis },
      generated: {},
      issues: [],
      outDir: '/tmp/campaign',
      recommendation,
      runId: 'run-id',
      status: 'succeeded',
      target: {
        index: 0,
        outDir: '/tmp/campaign',
        url: new URL('https://jobs.example.com/engineer?utm_source=mail'),
      },
    } satisfies PreparedCampaign
    const outputs = await Effect.runPromise(
      WorkflowOutputs.from([
        workflowOutput(campaignRunIdKey, 'run-id'),
        workflowOutput(targetArtifactManifestKey, {
          files: ['application.json', 'job.md'],
          generatedAt: '2026-07-10T00:00:00.000Z',
          version: 1,
        }),
        workflowOutput(targetDecisionsKey, campaign.decisions),
        workflowOutput(targetJobKey, {
          body: 'Job body',
          fetchedAt: '2026-07-10T00:00:00.000Z',
          url: campaign.target.url.href,
        }),
        workflowOutput(targetPreparedCampaignKey, campaign),
        workflowOutput(applicationRegistryAnalysisResultKey, registryAnalysis),
        workflowOutput(applicationRegistryConflictResolutionsKey, {}),
        workflowOutput(
          applicationRegistryFitAssessmentResultKey,
          fitAssessment
        ),
      ])
    )
    const capture = plugin.steps.find(
      (step) => step.id === 'application-registry.capture'
    )

    expect(plugin.steps.map((step) => step.id)).toEqual([
      'application-registry.sync',
      'application-registry.resolve-conflicts',
      'application-registry.analysis',
      'application-registry.capture',
    ])
    if (!capture) throw new Error('Capture step missing')
    await Effect.runPromise(capture.execute({ issues: [], outputs }))

    expect(captured).toHaveLength(1)
    expect(captured[0]?.operationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
    )
    expect(captured[0]).toMatchObject({
      applicationStatus: 'preparing',
      canonicalUrl: 'https://jobs.example.com/engineer',
      deviceId: 'desktop',
      details: registryAnalysis.details,
      jobContentHash: '0'.repeat(64),
      jobKey: 'url:https://jobs.example.com/engineer',
      compensations: registryAnalysis.compensations,
      fitAssessment,
      fitScore: 83,
      remotePolicy: 'Remote',
      submissionDetails,
      targetStage: 'apply_next',
    })
    expect(captured[0]?.capturedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u
    )

    const outputsWithoutRegistryReplacements = await Effect.runPromise(
      WorkflowOutputs.from([
        workflowOutput(campaignRunIdKey, 'run-id'),
        workflowOutput(targetArtifactManifestKey, {
          files: ['application.json', 'job.md'],
          generatedAt: '2026-07-10T00:00:00.000Z',
          version: 1,
        }),
        workflowOutput(targetDecisionsKey, campaign.decisions),
        workflowOutput(targetJobKey, {
          body: 'Job body',
          fetchedAt: '2026-07-10T00:00:00.000Z',
          url: campaign.target.url.href,
        }),
        workflowOutput(targetPreparedCampaignKey, campaign),
        workflowOutput(
          applicationRegistryAnalysisResultKey,
          emptyRegistryAnalysis
        ),
        workflowOutput(applicationRegistryConflictResolutionsKey, {}),
        workflowOutput(
          applicationRegistryFitAssessmentResultKey,
          fitAssessment
        ),
      ])
    )

    await Effect.runPromise(
      capture.execute({
        issues: [],
        outputs: outputsWithoutRegistryReplacements,
      })
    )

    expect(captured[1]?.compensations).toBeUndefined()
    expect(captured[1]?.details).toBeUndefined()
  })
})
