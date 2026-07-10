import { Effect } from 'effect'
import { Path } from 'effect/Path'
import { logInfo, withTelemetrySpan } from '../telemetry'
import type { CampaignIssue, RoutineStep } from '../workflow/routine'
import type {
  PreparedCampaignResult,
  PreparedCampaignRun,
} from '../workflow/types'
import { ensureDirectory, writeJson } from './files'

export type CampaignRunArtifact = {
  readonly campaigns: readonly {
    readonly decisions?: {
      readonly audience: string
      readonly profile: string
    }
    readonly error?: string
    readonly generated: {
      readonly hasLink: boolean
      readonly hasPdf: boolean
      readonly link?: string
      readonly pdfPath?: string
    }
    readonly issues: readonly CampaignIssue[]
    readonly outDir: string
    readonly status: PreparedCampaignResult['status']
    readonly url: string
  }[]
  readonly generatedAt: string
  readonly issues: readonly CampaignIssue[]
  readonly outDir: string
  readonly routine: {
    readonly steps: readonly RoutineStep<unknown>[]
  }
  readonly status: PreparedCampaignRun['status']
}

export const toCampaignRunArtifact = (
  run: PreparedCampaignRun
): CampaignRunArtifact => ({
  campaigns: run.campaigns.map((campaign) => ({
    decisions: campaign.status === 'failed' ? undefined : campaign.decisions,
    error: campaign.status === 'failed' ? campaign.error : undefined,
    generated: {
      hasLink: Boolean(campaign.generated.link),
      hasPdf: Boolean(campaign.generated.pdfPath),
      link: campaign.generated.link?.url,
      pdfPath: campaign.generated.pdfPath,
    },
    issues: campaign.issues,
    outDir: campaign.outDir,
    status: campaign.status,
    url: campaign.target.url.href,
  })),
  generatedAt: new Date().toISOString(),
  issues: run.issues,
  outDir: run.outDir,
  routine: { steps: run.routine.steps },
  status: run.status,
})

export const writeCampaignRunArtifacts = ({
  outDir,
  run,
}: {
  readonly outDir: string
  readonly run: CampaignRunArtifact
}) =>
  Effect.gen(function* () {
    const path = yield* Path

    yield* ensureDirectory(
      outDir,
      'Could not create campaign run output directory'
    )
    yield* writeJson(path.join(outDir, 'run.json'), run)
    yield* logInfo('Wrote application campaign run summary', {
      campaignCount: run.campaigns.length,
      outDir,
      status: run.status,
      warningCount: run.issues.filter((issue) => issue.severity === 'warning')
        .length,
    })
  }).pipe(
    withTelemetrySpan('application-campaign.artifacts.write-run', {
      campaignCount: run.campaigns.length,
      outDir,
    })
  )
