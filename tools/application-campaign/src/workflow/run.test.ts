import { describe, expect, test } from 'bun:test'
import {
  PdfExporter,
  type PdfExporterService,
  PdfProcessError,
  type ProfilePdfBatchExportRequest,
} from '@cv/pdf-export'
import type { PrivateContentLinkResult } from '@cv/private-content-link'
import { Effect, Layer } from 'effect'
import type { CampaignRecommendation } from '../ai/schema'
import type { PrepareCampaignOptions } from '../config/model'
import { formatCampaignError } from './issues'
import { resolveCampaignRoutine } from './routine'
import { campaignRunStatus, exportCampaignPdfs } from './run'
import type { CampaignDraft } from './types'

const target = {
  index: 0,
  outDir: '/tmp/application-campaign',
  url: new URL('https://jobs.example.com/role'),
}

const options = {
  concurrency: 2,
  contentRoot: '/tmp/content',
  excludedProfiles: ['default'],
  generate: true,
  locale: 'en',
  materials: 'all',
  outDir: '/tmp/application-campaign',
  pdfOutDir: '/tmp/application-campaign-pdfs',
  skipBuild: false,
  skipPdf: false,
  targets: [target],
  webBaseUrl: new URL('https://cv.example.com'),
} satisfies PrepareCampaignOptions

const mintedLink = {
  audience: 'acme',
  audienceId: 'audience-id',
  locale: 'en',
  profile: 'typescript-full-stack',
  profileId: 'profile-id',
  token: 'private-token',
  url: 'https://cv.example.com/en/a/audience-id/?p=private-token',
} satisfies PrivateContentLinkResult

const recommendation = {
  coverLetter: { body: 'Hello', subject: 'Application' },
  email: { body: 'Hello', subject: 'Application' },
  followUpQuestions: [],
  job: {
    applicationQuestions: [],
    company: 'Acme',
    concerns: [],
    coverLetterInstructions: [],
    coverLetterRequired: false,
    differentiators: [],
    hiringSignals: [],
    location: 'Remote',
    niceToHaveSignals: [],
    requiredSignals: [],
    role: 'Engineer',
    routineSignals: [],
    seniority: 'Senior',
    summary: 'Role',
    technologies: [],
    workMode: 'Remote',
  },
  matchedEvidence: [],
  recommendation: {
    alternatives: [],
    audienceSlug: 'acme',
    confidence: 0.9,
    profile: 'typescript-full-stack',
    rationale: 'Relevant experience',
  },
} satisfies CampaignRecommendation

const failingPdfLayer = Layer.succeed(PdfExporter, {
  exportProfile: () =>
    Effect.fail(
      new PdfProcessError({
        cause: new Error('pdf export failed'),
        command: 'pdf',
        message: 'pdf export failed',
      })
    ),
  exportProfiles: () =>
    Effect.fail(
      new PdfProcessError({
        cause: new Error('pdf export failed'),
        command: 'pdf',
        message: 'pdf export failed',
      })
    ),
  exportPublic: () => Effect.succeed([]),
} satisfies PdfExporterService)

const campaignDraft = async () => {
  const routine = await Effect.runPromise(resolveCampaignRoutine(options))

  return {
    decisions: { audience: 'acme', profile: 'typescript-full-stack' },
    generated: { link: mintedLink },
    issues: [],
    job: {
      body: 'Job',
      fetchedAt: '2026-07-09T00:00:00.000Z',
      url: target.url.href,
    },
    outDir: target.outDir,
    recommendation,
    routine: routine.targets[0],
    status: 'succeeded',
    target,
  } satisfies CampaignDraft
}

describe('campaign PDF stage', () => {
  test('keeps a minted link and marks the campaign partial when batch PDF export fails', async () => {
    const draft = await campaignDraft()

    const [result] = await Effect.runPromise(
      exportCampaignPdfs([draft], options).pipe(Effect.provide(failingPdfLayer))
    )

    expect(result?.generated.link?.url).toBe(mintedLink.url)
    expect(result?.generated.pdfPath).toBeUndefined()
    expect(result?.status).toBe('partial')
    expect(result?.issues[0]?.step).toBe('target:0:private-pdf')
  })

  test('passes the resolved web base URL to the PDF exporter', async () => {
    const draft = await campaignDraft()
    let request: ProfilePdfBatchExportRequest | undefined
    const pdfLayer = Layer.succeed(PdfExporter, {
      exportProfile: () => Effect.die('unused'),
      exportProfiles: (input) => {
        request = input
        return Effect.succeed([
          {
            audienceId: mintedLink.audienceId,
            locale: 'en',
            outputPath: '/tmp/application-campaign-pdfs/acme.pdf',
            previewPath: '/en/a/',
          },
        ])
      },
      exportPublic: () => Effect.die('unused'),
    } satisfies PdfExporterService)

    const [result] = await Effect.runPromise(
      exportCampaignPdfs([draft], options).pipe(Effect.provide(pdfLayer))
    )

    expect(request?.webBaseUrl).toBe(options.webBaseUrl)
    expect(result?.generated.pdfPath).toBe(
      '/tmp/application-campaign-pdfs/acme.pdf'
    )
    expect(result?.status).toBe('succeeded')
  })
})

describe('campaign run status', () => {
  test('distinguishes success, partial completion, and total failure', () => {
    expect(campaignRunStatus(['succeeded'])).toBe('succeeded')
    expect(campaignRunStatus(['partial'])).toBe('partial')
    expect(campaignRunStatus(['failed'])).toBe('failed')
    expect(campaignRunStatus(['succeeded', 'failed'])).toBe('partial')
  })
})

describe('campaign error formatting', () => {
  test('preserves distinct nested causes without repeating wrappers', () => {
    expect(
      formatCampaignError(
        new Error('Could not render PDF', {
          cause: new Error('Page.printToPDF failed'),
        })
      )
    ).toBe('Could not render PDF: Page.printToPDF failed')
    expect(
      formatCampaignError(
        new Error('PDF failed', { cause: new Error('PDF failed') })
      )
    ).toBe('PDF failed')
  })
})
