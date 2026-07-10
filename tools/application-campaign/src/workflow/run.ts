import { exportProfilePdfs } from '@cv/pdf-export'
import type { PrivateContentLinkResult } from '@cv/private-content-link'
import { Effect } from 'effect'
import { writeCampaignArtifacts } from '../artifacts/write-campaign'
import {
  toCampaignRunArtifact,
  writeCampaignRunArtifacts,
} from '../artifacts/write-run'
import type { PrepareCampaignOptions } from '../config/model'
import { logInfo, logWarning, urlHost, withTelemetrySpan } from '../telemetry'
import { slugify } from '../text'
import { formatCampaignError, runtimeError, uniqueIssues } from './issues'
import { prepareSharedCampaignInputs } from './profile-inputs'
import { type CampaignTargetRoutine, resolveCampaignRoutine } from './routine'
import { prepareCampaignTarget } from './target'
import type {
  CampaignDraft,
  CampaignDraftResult,
  FailedCampaign,
  GeneratedCampaign,
  PreparedCampaignResult,
  PreparedCampaignRun,
} from './types'

export type { PreparedCampaignResult, PreparedCampaignRun } from './types'

const recoverTargetFailure = ({
  cause,
  generated = {},
  messagePrefix = 'Campaign target failed',
  step,
  targetRoutine,
}: {
  readonly cause: unknown
  readonly generated?: GeneratedCampaign
  readonly messagePrefix?: string
  readonly step?: string
  readonly targetRoutine: CampaignTargetRoutine
}): FailedCampaign => {
  const message = formatCampaignError(cause)
  const issue = runtimeError({
    message: `${messagePrefix}: ${message}`,
    step: step ?? `target:${targetRoutine.target.index}:prepare`,
    targetRoutine,
  })

  return {
    error: message,
    generated,
    issues: uniqueIssues([...targetRoutine.issues, issue]),
    outDir: targetRoutine.target.outDir,
    status: 'failed',
    target: targetRoutine.target,
  }
}

type PdfCandidate = {
  readonly campaignIndex: number
  readonly draft: CampaignDraft
  readonly link: PrivateContentLinkResult
  readonly outputFileName: string
  readonly webBaseUrl: URL
}

const pdfCandidates = (
  campaigns: readonly CampaignDraftResult[],
  locale: string
): readonly PdfCandidate[] => {
  const pending = campaigns.flatMap((campaign, campaignIndex) => {
    if (
      campaign.status === 'failed' ||
      !campaign.generated.link ||
      campaign.routine.privatePdf.status === 'skipped'
    ) {
      return []
    }

    const stem = `cv-${locale}-${slugify(campaign.decisions.audience, 'application')}`

    return [
      {
        campaignIndex,
        draft: campaign,
        link: campaign.generated.link,
        stem,
        webBaseUrl: campaign.routine.privatePdf.config.webBaseUrl,
      },
    ]
  })
  const totals = new Map<string, number>()

  for (const candidate of pending) {
    totals.set(candidate.stem, (totals.get(candidate.stem) ?? 0) + 1)
  }

  const seen = new Map<string, number>()

  return pending.map((candidate) => {
    const occurrence = (seen.get(candidate.stem) ?? 0) + 1
    seen.set(candidate.stem, occurrence)

    return {
      campaignIndex: candidate.campaignIndex,
      draft: candidate.draft,
      link: candidate.link,
      outputFileName: `${candidate.stem}${(totals.get(candidate.stem) ?? 0) > 1 ? `-${occurrence}` : ''}.pdf`,
      webBaseUrl: candidate.webBaseUrl,
    }
  })
}

export const exportCampaignPdfs = (
  campaigns: readonly CampaignDraftResult[],
  options: PrepareCampaignOptions
) =>
  Effect.gen(function* () {
    const candidates = pdfCandidates(campaigns, options.locale)

    if (candidates.length === 0) {
      return campaigns
    }

    yield* logInfo('Exporting private campaign PDFs as one batch', {
      outputDir: options.pdfOutDir,
      pdfCount: candidates.length,
      skipBuild: options.skipBuild,
    })

    const outcome = yield* exportProfilePdfs({
      items: candidates.map(({ link, outputFileName }) => ({
        audienceId: link.audienceId,
        locale: options.locale,
        outputFileName,
        token: link.token,
      })),
      outputDir: options.pdfOutDir,
      skipBuild: options.skipBuild,
      webBaseUrl: candidates[0]?.webBaseUrl,
    }).pipe(
      Effect.map((results) => ({ results, status: 'succeeded' as const })),
      Effect.catch((cause) =>
        Effect.succeed({ cause, status: 'failed' as const })
      )
    )

    if (outcome.status === 'failed') {
      const byIndex = new Map(
        candidates.map((candidate) => [
          candidate.campaignIndex,
          runtimeError({
            message: `Could not export private profile PDF: ${formatCampaignError(outcome.cause)}`,
            step: candidate.draft.routine.privatePdf.id,
            targetRoutine: candidate.draft.routine,
          }),
        ])
      )

      yield* logWarning('Private campaign PDF batch failed', {
        error: formatCampaignError(outcome.cause),
        pdfCount: candidates.length,
      })

      return campaigns.map((campaign, index) => {
        const issue = byIndex.get(index)

        return issue && campaign.status !== 'failed'
          ? {
              ...campaign,
              issues: uniqueIssues([...campaign.issues, issue]),
              status: 'partial' as const,
            }
          : campaign
      })
    }

    const pdfPaths = new Map(
      candidates.map((candidate, index) => [
        candidate.campaignIndex,
        outcome.results[index]?.outputPath,
      ])
    )

    return campaigns.map((campaign, index) => {
      const pdfPath = pdfPaths.get(index)

      return pdfPath && campaign.status !== 'failed'
        ? {
            ...campaign,
            generated: { ...campaign.generated, pdfPath },
          }
        : campaign
    })
  })

const writeTargetArtifacts = (
  campaign: CampaignDraftResult,
  options: PrepareCampaignOptions
) => {
  if (campaign.status === 'failed') {
    return Effect.succeed(campaign)
  }

  return writeCampaignArtifacts({
    decisions: campaign.decisions,
    generated: campaign.generated,
    issues: campaign.issues,
    job: campaign.job,
    materialsMode: options.materials,
    outDir: campaign.outDir,
    recommendation: campaign.recommendation,
    routineSteps: campaign.routine.steps,
    status: campaign.status,
  }).pipe(
    Effect.map(() => {
      const { job: _job, routine: _routine, ...result } = campaign

      return result satisfies PreparedCampaignResult
    }),
    Effect.catch((cause) =>
      Effect.succeed(
        recoverTargetFailure({
          cause,
          generated: campaign.generated,
          messagePrefix: 'Could not write campaign artifacts',
          step: campaign.routine.writeArtifacts.id,
          targetRoutine: campaign.routine,
        })
      )
    )
  )
}

export const campaignRunStatus = (
  statuses: readonly PreparedCampaignResult['status'][]
): PreparedCampaignRun['status'] => {
  if (statuses.every((status) => status === 'succeeded')) {
    return 'succeeded'
  }

  return statuses.every((status) => status === 'failed') ? 'failed' : 'partial'
}

export const prepareCampaign = (options: PrepareCampaignOptions) =>
  Effect.gen(function* () {
    yield* logInfo('Preparing application campaign run', {
      concurrency: options.concurrency,
      excludedProfileCount: options.excludedProfiles.length,
      generate: options.generate,
      hasFixedAudience: Boolean(options.audience),
      hasFixedProfile: Boolean(options.profile),
      locale: options.locale,
      materials: options.materials,
      targetCount: options.targets.length,
    })

    const routine = yield* resolveCampaignRoutine(options)
    const sharedInputs = yield* prepareSharedCampaignInputs(options)
    const drafts = yield* Effect.forEach(
      routine.targets,
      (targetRoutine) =>
        prepareCampaignTarget({
          candidateProfiles: sharedInputs.candidateProfiles,
          options,
          profileCatalog: sharedInputs.profileCatalog,
          profileSummaries: sharedInputs.profileSummaries,
          targetRoutine,
        }).pipe(
          Effect.catch((cause) =>
            logWarning('Application campaign target failed', {
              error: formatCampaignError(cause),
              jobHost: urlHost(targetRoutine.target.url),
              targetIndex: targetRoutine.target.index,
            }).pipe(Effect.as(recoverTargetFailure({ cause, targetRoutine })))
          )
        ),
      { concurrency: options.concurrency }
    )
    const campaignsWithPdfs = yield* exportCampaignPdfs(drafts, options)
    const campaigns = yield* Effect.forEach(
      campaignsWithPdfs,
      (campaign) => writeTargetArtifacts(campaign, options),
      { concurrency: options.concurrency }
    )
    const issues = uniqueIssues([
      ...routine.issues,
      ...campaigns.flatMap((campaign) => campaign.issues),
    ])
    const result = {
      campaigns,
      issues,
      outDir: options.outDir,
      routine,
      status: campaignRunStatus(campaigns.map((campaign) => campaign.status)),
    } satisfies PreparedCampaignRun

    yield* writeCampaignRunArtifacts({
      outDir: options.outDir,
      run: toCampaignRunArtifact(result),
    })

    yield* logInfo('Finished application campaign run', {
      failedCampaignCount: campaigns.filter(
        (campaign) => campaign.status === 'failed'
      ).length,
      partialCampaignCount: campaigns.filter(
        (campaign) => campaign.status === 'partial'
      ).length,
      status: result.status,
      succeededCampaignCount: campaigns.filter(
        (campaign) => campaign.status === 'succeeded'
      ).length,
      targetCount: campaigns.length,
    })

    return result
  }).pipe(
    withTelemetrySpan('application-campaign.prepare', {
      generate: options.generate,
      hasFixedAudience: Boolean(options.audience),
      hasFixedProfile: Boolean(options.profile),
      locale: options.locale,
      targetCount: options.targets.length,
    })
  )
