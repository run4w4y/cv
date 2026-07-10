import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import type { PrepareCampaignOptions } from '../config/model'
import { resolveCampaignRoutine } from '../workflow/routine'
import { formatCampaignPlan, resolveCampaignOutputMode } from './presenter'

const options = {
  concurrency: 2,
  contentRoot: '/tmp/content',
  excludedProfiles: ['default'],
  generate: true,
  locale: 'en',
  materials: 'all',
  outDir: '/tmp/applications',
  pdfOutDir: '/tmp/pdfs',
  skipBuild: false,
  skipPdf: false,
  targets: [
    {
      index: 0,
      outDir: '/tmp/applications/example',
      url: new URL('https://jobs.example.com/platform'),
    },
  ],
} satisfies PrepareCampaignOptions

describe('campaign output mode', () => {
  test('uses pretty output only for an interactive auto-mode run', () => {
    expect(
      resolveCampaignOutputMode({
        isCi: false,
        isTty: true,
        requested: 'auto',
      })
    ).toBe('pretty')
    expect(
      resolveCampaignOutputMode({
        isCi: true,
        isTty: true,
        requested: 'auto',
      })
    ).toBe('plain')
    expect(
      resolveCampaignOutputMode({
        diagnosticLogs: true,
        isCi: false,
        isTty: true,
        requested: 'pretty',
      })
    ).toBe('plain')
  })
})

describe('campaign plan formatting', () => {
  test('shows runnable, skipped, target, and final manifest steps', async () => {
    const routine = await Effect.runPromise(resolveCampaignRoutine(options))
    const plan = formatCampaignPlan(routine)

    expect(plan).toContain('Plan (5 runnable, 2 skipped)')
    expect(plan).toContain('jobs.example.com/platform')
    expect(plan).toContain('[-] Mint private CV link')
    expect(plan).toContain('[ ] Write campaign run manifest')
  })
})
