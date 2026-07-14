import { describe, expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { ConfigProvider, Effect, Layer } from 'effect'
import { resolveCampaignRoutine } from '../workflow/routine'
import type { PrepareCampaignOverrides } from './model'
import { resolvePrepareCampaignOptions } from './resolve'

const baseOverrides = {
  urls: [new URL('https://jobs.example.com/senior-backend-engineer')],
} satisfies PrepareCampaignOverrides

const resolveOptions = (
  overrides: PrepareCampaignOverrides = baseOverrides,
  env: Record<string, string> = {}
) =>
  Effect.runPromise(
    resolvePrepareCampaignOptions(overrides).pipe(
      Effect.provide(
        Layer.merge(
          BunServices.layer,
          ConfigProvider.layer(ConfigProvider.fromEnv({ env }))
        )
      )
    )
  )

describe('application campaign config', () => {
  test('reads env config and lets an explicit PDF directory override it', async () => {
    const { campaign } = await resolveOptions(
      { ...baseOverrides, pdfOutDir: 'cli-pdfs' },
      {
        APPLICATION_CAMPAIGN_CONTENT_ROOT: 'env-content',
        APPLICATION_CAMPAIGN_PDF_DIR: 'env-pdfs',
      }
    )

    expect(campaign.contentRoot.endsWith('/env-content')).toBeTrue()
    expect(campaign.pdfOutDir.endsWith('/cli-pdfs')).toBeTrue()
  })

  test('defaults to the benchmarked mixed-model route', async () => {
    const { advisor, campaign } = await resolveOptions()

    expect(advisor.analysis).toEqual({
      model: 'gpt-5.6-terra',
      reasoningEffort: 'low',
    })
    expect(advisor.recommendation).toEqual({
      model: 'gpt-5.6-sol',
      reasoningEffort: 'low',
    })
    expect(campaign.excludedProfiles).toBeUndefined()
    expect(campaign.generate).toBeTrue()
    expect(campaign.materials).toBe('all')
  })

  test('resolves the deployed base URL from CV_WEB_HOST', async () => {
    const { campaign } = await resolveOptions(baseOverrides, {
      CV_WEB_HOST: 'cv.example.com',
    })

    expect(campaign.webBaseUrl?.href).toBe('https://cv.example.com/')
  })

  test('normalizes a slashless deployed path as a directory URL', async () => {
    const { campaign } = await resolveOptions(baseOverrides, {
      CV_WEB_BASE_URL: 'https://cv.example.com/cv',
    })

    expect(campaign.webBaseUrl?.href).toBe('https://cv.example.com/cv/')
  })

  test('combines repeated URLs, URL-file contents, and env URL lists', async () => {
    const { campaign } = await resolveOptions(
      {
        urlFileContents: [
          'https://jobs.example.com/frontend',
          'https://jobs.example.com/senior-backend-engineer',
        ].join('\n'),
        urls: [new URL('https://jobs.example.com/backend')],
      },
      {
        APPLICATION_CAMPAIGN_URLS: 'https://jobs.example.com/platform',
      }
    )

    expect(campaign.targets.map((target) => target.url.href)).toEqual([
      'https://jobs.example.com/backend',
      'https://jobs.example.com/frontend',
      'https://jobs.example.com/senior-backend-engineer',
      'https://jobs.example.com/platform',
    ])
    expect(campaign.outDir.endsWith('/.cv-work/applications')).toBeTrue()
  })

  test('resolves missing generation configuration as a warning and skipped steps', async () => {
    const { campaign } = await resolveOptions()
    const routine = await Effect.runPromise(resolveCampaignRoutine(campaign))

    expect(routine.targets[0]?.privateLink.status).toBe('skipped')
    expect(routine.targets[0]?.privatePdf.status).toBe('skipped')
    expect(
      routine.issues.some(
        (issue) =>
          issue.severity === 'warning' &&
          issue.message.includes('no web base URL resolved')
      )
    ).toBeTrue()
  })

  test('lets shared reasoning and materials settings override env config', async () => {
    const { advisor, campaign } = await resolveOptions(
      {
        ...baseOverrides,
        materials: 'none',
        reasoningEffort: 'high',
      },
      {
        APPLICATION_CAMPAIGN_CODEX_REASONING_EFFORT: 'low',
      }
    )

    expect(advisor.analysis.reasoningEffort).toBe('high')
    expect(advisor.recommendation.reasoningEffort).toBe('high')
    expect(campaign.materials).toBe('none')
  })

  test('supports independent model routes with CLI precedence over env', async () => {
    const { advisor } = await resolveOptions(
      {
        ...baseOverrides,
        analysisModel: 'cli-analysis',
        recommendationReasoningEffort: 'high',
      },
      {
        APPLICATION_CAMPAIGN_CODEX_ANALYSIS_MODEL: 'env-analysis',
        APPLICATION_CAMPAIGN_CODEX_ANALYSIS_REASONING_EFFORT: 'medium',
        APPLICATION_CAMPAIGN_CODEX_RECOMMENDATION_MODEL: 'env-recommendation',
        APPLICATION_CAMPAIGN_CODEX_RECOMMENDATION_REASONING_EFFORT: 'low',
      }
    )

    expect(advisor.analysis).toEqual({
      model: 'cli-analysis',
      reasoningEffort: 'medium',
    })
    expect(advisor.recommendation).toEqual({
      model: 'env-recommendation',
      reasoningEffort: 'high',
    })
  })

  test('supports an explicitly empty profile exclusion list', async () => {
    const { campaign } = await resolveOptions(
      { ...baseOverrides, excludedProfiles: [] },
      { APPLICATION_CAMPAIGN_EXCLUDED_PROFILES: 'default' }
    )

    expect(campaign.excludedProfiles).toEqual([])
  })

  test('rejects malformed env concurrency with Effect config', async () => {
    await expect(
      resolveOptions(baseOverrides, {
        APPLICATION_CAMPAIGN_CONCURRENCY: '2x',
      })
    ).rejects.toThrow('APPLICATION_CAMPAIGN_CONCURRENCY')
  })
})
