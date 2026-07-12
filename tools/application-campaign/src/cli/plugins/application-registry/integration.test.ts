import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  ApplicationAdvisor,
  type CampaignAnalysisPromptContribution,
  CampaignPlugins,
  type CampaignProfileSourceService,
  type CampaignRecommendation,
  defineCampaignAnalysisContribution,
  makeApplicationCampaignRuntimeLayer,
  makeCampaignPluginsService,
  prepareCampaign,
  type WorkflowStepContext,
  workflowKey,
  workflowOutput,
} from '@cv/application-campaign'
import { type Context, Crypto, Effect, Schema } from 'effect'
import {
  type ApplicationRegistryAnalysis,
  type ApplicationRegistryCampaignCaptureRequest,
  type ApplicationRegistryCampaignClient,
  makeApplicationRegistryCampaignPlugin,
} from './index'

const temporaryDirectories: string[] = []
const servers: Bun.Server<unknown>[] = []

afterEach(async () => {
  for (const server of servers.splice(0)) server.stop(true)
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  )
})

const submissionDetails = {
  additionalInstructions: null,
  applicationMethod: 'Web form',
  applicationQuestions: ['Why this role?'],
  applicationUrl: 'https://jobs.example.com/apply',
  contactEmail: null,
  coverLetterInstructions: 'Address the platform team.',
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
      currencyCode: 'JPY',
      kind: 'base_salary',
      maximumMinor: 14_000_000,
      minimumMinor: 10_000_000,
      period: 'year',
      rawText: 'JPY 10m–14m',
      source: 'job-posting',
    },
  ],
  details: {
    applyFromAbroad: 'Accepted',
    countryCode: 'JP',
    employmentType: 'Full-time',
    languageRequirements: ['English'],
    region: null,
    relocationSupport: 'Available',
    remoteRegion: 'Worldwide',
    residenceRequirement: null,
    timezoneOverlap: 'JST business hours',
    visaSponsorship: 'Available',
    workAuthorization: null,
    workMode: 'Remote with JST overlap',
  },
  submissionDetails,
} satisfies ApplicationRegistryAnalysis

const recommendation = {
  coverLetter: { body: '', subject: '' },
  email: { body: '', subject: '' },
  followUpQuestions: [],
  job: {
    applicationQuestions: ['Why this role?'],
    company: 'Acme',
    concerns: [],
    coverLetterInstructions: ['Address the platform team.'],
    coverLetterRequired: true,
    differentiators: ['Effect experience'],
    hiringSignals: ['Distributed systems'],
    location: 'Remote',
    niceToHaveSignals: [],
    requiredSignals: ['TypeScript'],
    role: 'Platform Engineer',
    routineSignals: [],
    seniority: 'Senior',
    summary: 'Build a reliable platform.',
    technologies: ['TypeScript', 'Effect'],
    workMode: 'Remote',
  },
  matchedEvidence: [],
  recommendation: {
    alternatives: [],
    audienceSlug: 'acme',
    confidence: 0.93,
    profile: 'specialist',
    rationale: 'Direct platform experience.',
  },
} satisfies CampaignRecommendation

const profileSource: CampaignProfileSourceService = {
  open: () =>
    Effect.succeed({
      availableProfiles: { en: ['specialist'] },
      defaultLocale: 'en',
      defaultProfile: 'default',
      locales: ['en'],
      profiles: ['specialist'],
      load: ({ locale }) =>
        Effect.succeed({
          availableProfiles: { en: ['specialist'] },
          content: {
            [locale]: {
              specialist: {
                experience: ['Built distributed TypeScript platforms'],
                role: 'Platform Engineer',
              },
            },
          },
          defaultLocale: 'en',
          defaultProfile: 'default',
          locales: ['en'],
          profiles: ['specialist'],
        }),
    }),
}

describe('application registry campaign integration', () => {
  test('flows a plugin prompt contribution through the graph into capture', async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), 'campaign-plugin-'))
    temporaryDirectories.push(outputRoot)
    const server = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch: () =>
        new Response(
          'Acme seeks a remote platform engineer. Apply with a CV and answer: Why this role?',
          { headers: { 'content-type': 'text/plain' } }
        ),
    })
    servers.push(server)
    const targetUrl = new URL('/jobs/platform?utm_source=test', server.url)
    const captured: ApplicationRegistryCampaignCaptureRequest[] = []
    let analysisPrompt = ''
    let extensionNames: readonly string[] = []
    const advisor = {
      analyzeJob: (request) =>
        Effect.gen(function* () {
          analysisPrompt = request.prompt
          extensionNames = Object.keys(request.extensionSchemas)
          const extensionSchema =
            request.extensionSchemas['application-registry']
          if (!extensionSchema) {
            return yield* Effect.die(
              new Error('Registry extension schema was not installed')
            )
          }
          const decoded = yield* Schema.decodeUnknownEffect(extensionSchema)(
            registryAnalysis
          ).pipe(Effect.orDie)
          const testNoteSchema = request.extensionSchemas['test-note']
          if (!testNoteSchema) {
            return yield* Effect.die(
              new Error('Second extension schema was not installed')
            )
          }
          const testNote = yield* Schema.decodeUnknownEffect(testNoteSchema)(
            'captured in the shared analysis step'
          ).pipe(Effect.orDie)

          return {
            extensions: {
              'application-registry': decoded,
              'test-note': testNote,
            },
            job: recommendation.job,
            profileShortlist: [
              {
                evidenceNeeded: [],
                profile: 'specialist',
                rationale: 'The only matching profile.',
              },
            ],
          }
        }),
      recommend: () => Effect.succeed(recommendation),
      shortlistProfiles: () =>
        Effect.die(new Error('Unexpected standalone shortlist call')),
      structured: {
        run: () => Effect.die(new Error('Unexpected structured AI call')),
      },
    } satisfies Context.Service.Shape<typeof ApplicationAdvisor>
    const client = {
      capture: (request) =>
        Effect.sync(() => {
          captured.push(request)
          return {
            operationId: request.operationId,
            response: { application: { id: 'application-id' } },
            status: 'synced' as const,
          }
        }),
      sync: () => Effect.succeed({ failed: [], synced: 0 }),
    } satisfies ApplicationRegistryCampaignClient
    const targetOutDir = join(outputRoot, 'target')
    const options = {
      concurrency: 1,
      contentRoot: '/trusted-content',
      excludedProfiles: [],
      generate: false,
      locale: 'en',
      materials: 'none',
      outDir: outputRoot,
      pdfOutDir: join(outputRoot, 'pdf'),
      profile: 'specialist',
      skipBuild: true,
      skipPdf: true,
      targets: [{ index: 0, outDir: targetOutDir, url: targetUrl }],
    } as const

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const crypto = yield* Crypto.Crypto
        const registryPlugin = makeApplicationRegistryCampaignPlugin({
          client,
          crypto,
          deviceId: 'integration-test',
        })
        const testNoteContributionKey = workflowKey<
          CampaignAnalysisPromptContribution<string>
        >('application-registry.test-note.contribution')
        const testNoteResultKey = workflowKey<string>(
          'application-registry.test-note'
        )
        const testNoteContribution = defineCampaignAnalysisContribution({
          key: testNoteContributionKey,
          name: 'test-note',
          resultKey: testNoteResultKey,
          stepId: 'application-registry.analysis',
        })
        const plugins = yield* makeCampaignPluginsService([
          {
            ...registryPlugin,
            analysisContributions: [
              ...(registryPlugin.analysisContributions ?? []),
              testNoteContribution,
            ],
            steps: [
              ...registryPlugin.steps.map((step) =>
                step.id === testNoteContribution.stepId
                  ? {
                      ...step,
                      execute: (context: WorkflowStepContext) =>
                        step.execute(context).pipe(
                          Effect.map((outputs) => [
                            ...outputs,
                            workflowOutput(testNoteContributionKey, {
                              instructions: 'Return a short test note.',
                              schema: Schema.String,
                            }),
                          ])
                        ),
                    }
                  : step
              ),
              {
                dependsOn: ['application-registry.sync'],
                execute: () => Effect.succeed([]),
                failurePolicy: 'warn',
                id: 'application-registry.shared-sync-consumer',
                label: 'Consume the shared registry setup',
                scope: 'target',
              },
            ],
          },
        ])

        return yield* prepareCampaign(options).pipe(
          Effect.provideService(ApplicationAdvisor, advisor),
          Effect.provideService(CampaignPlugins, plugins)
        )
      }).pipe(
        Effect.provide(makeApplicationCampaignRuntimeLayer(profileSource))
      )
    )

    expect(result.status).toBe('succeeded')
    expect(extensionNames).toEqual(['application-registry', 'test-note'])
    expect(analysisPrompt).toContain('applicationQuestions')
    expect(analysisPrompt).toContain('requiredDocuments')
    expect(analysisPrompt).toContain('OpportunityDetails')
    expect(analysisPrompt).toContain('original currency')
    expect(analysisPrompt).toContain('JPY 10m is 10000000 yen')
    expect(captured).toHaveLength(1)
    expect(captured[0]).toMatchObject({
      applicationStatus: 'preparing',
      deviceId: 'integration-test',
      details: registryAnalysis.details,
      compensations: registryAnalysis.compensations,
      profile: 'specialist',
      remotePolicy: 'Remote',
      submissionDetails,
      targetStage: 'apply_next',
    })
    expect(captured[0]?.canonicalUrl).toBe(
      new URL('/jobs/platform', server.url).href
    )
    expect(
      await readFile(join(targetOutDir, 'application.json'), 'utf8')
    ).toContain('application-registry')
  })
})
