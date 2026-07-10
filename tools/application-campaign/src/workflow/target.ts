import {
  mintPrivateContentLink,
  type PrivateContentLinkResult,
} from '@cv/private-content-link'
import { Effect } from 'effect'
import { ApplicationAdvisor } from '../ai/advisor'
import {
  renderProfileShortlistPrompt,
  renderRecommendationPrompt,
} from '../ai/prompt'
import type { CampaignProfileShortlist } from '../ai/schema'
import type { PrepareCampaignOptions } from '../config/model'
import { fetchJobSource } from '../job'
import { profileContextLocale, uniqueProfileSlugs } from '../profiles/catalog'
import { renderProfilesMarkdown } from '../profiles/render-full'
import { logInfo, logWarning, urlHost, withTelemetrySpan } from '../telemetry'
import { slugify } from '../text'
import { formatCampaignError, runtimeError, uniqueIssues } from './issues'
import type { ProfileCatalog } from './profile-inputs'
import {
  CampaignProgressEvent,
  reportCampaignProgress,
  reportStepDetail,
  trackCampaignStep,
} from './progress'
import type { CampaignTargetRoutine } from './routine'
import type {
  CampaignDecisions,
  CampaignDraft,
  GeneratedCampaign,
} from './types'

const determinedProfile = ({
  candidateProfiles,
  fixedProfile,
}: {
  readonly candidateProfiles: readonly string[]
  readonly fixedProfile?: string
}) =>
  fixedProfile ??
  (candidateProfiles.length === 1 ? candidateProfiles[0] : undefined)

const applyMaterialsMode = (
  recommendation: CampaignDraft['recommendation'],
  options: PrepareCampaignOptions
): CampaignDraft['recommendation'] =>
  options.materials === 'all'
    ? recommendation
    : {
        ...recommendation,
        coverLetter: { body: '', subject: '' },
        email: { body: '', subject: '' },
      }

const resolveDecisions = ({
  options,
  recommendation,
}: {
  readonly options: PrepareCampaignOptions
  readonly recommendation: CampaignDraft['recommendation']
}): CampaignDecisions => ({
  audience:
    options.audience ??
    slugify(
      recommendation.recommendation.audienceSlug,
      slugify(recommendation.job.company, 'application')
    ),
  profile: options.profile ?? recommendation.recommendation.profile,
})

const mintLink = ({
  decisions,
  options,
  targetRoutine,
}: {
  readonly decisions: CampaignDecisions
  readonly options: PrepareCampaignOptions
  readonly targetRoutine: CampaignTargetRoutine
}) => {
  if (targetRoutine.privateLink.status === 'skipped') {
    return Effect.succeed({
      generated: {} satisfies GeneratedCampaign,
      issues: targetRoutine.issues,
      status: 'succeeded' as const,
    })
  }

  return trackCampaignStep(
    targetRoutine.privateLink,
    mintPrivateContentLink({
      audience: decisions.audience,
      baseUrl: targetRoutine.privateLink.config.webBaseUrl,
      locale: options.locale,
      profile: decisions.profile,
    })
  ).pipe(
    Effect.tap((link) =>
      logInfo('Minted private CV link', {
        audienceId: link.audienceId,
        locale: options.locale,
        profile: decisions.profile,
      })
    ),
    Effect.map((link: PrivateContentLinkResult) => ({
      generated: { link } satisfies GeneratedCampaign,
      issues: targetRoutine.issues,
      status: 'succeeded' as const,
    })),
    Effect.catch((cause) => {
      const issue = runtimeError({
        message: `Could not mint private CV link: ${formatCampaignError(cause)}`,
        step: targetRoutine.privateLink.id,
        targetRoutine,
      })

      return logWarning(issue.message, {
        jobHost: urlHost(targetRoutine.target.url),
        step: issue.step,
      }).pipe(
        Effect.as({
          generated: {} satisfies GeneratedCampaign,
          issues: uniqueIssues([...targetRoutine.issues, issue]),
          status: 'partial' as const,
        })
      )
    })
  )
}

export const prepareCampaignTarget = ({
  candidateProfiles,
  options,
  profileCatalog,
  profileSummaries,
  targetRoutine,
}: {
  readonly candidateProfiles: readonly string[]
  readonly options: PrepareCampaignOptions
  readonly profileCatalog: ProfileCatalog
  readonly profileSummaries: string
  readonly targetRoutine: CampaignTargetRoutine
}) =>
  Effect.gen(function* () {
    const { target } = targetRoutine

    yield* logInfo('Preparing application campaign target', {
      generate: options.generate,
      hasFixedAudience: Boolean(options.audience),
      hasFixedProfile: Boolean(options.profile),
      jobHost: urlHost(target.url),
      locale: options.locale,
      materials: options.materials,
      outDir: target.outDir,
    })

    const job = yield* trackCampaignStep(
      targetRoutine.fetchJob,
      fetchJobSource(target.url)
    )
    const { decisions, recommendation } = yield* trackCampaignStep(
      targetRoutine.recommend,
      Effect.gen(function* () {
        const advisor = yield* ApplicationAdvisor
        const fixedProfile = determinedProfile({
          candidateProfiles,
          fixedProfile: options.profile,
        })
        let profileShortlist: CampaignProfileShortlist | undefined

        if (!fixedProfile) {
          yield* reportStepDetail(
            targetRoutine.recommend,
            'Shortlisting candidate profiles with Codex'
          )
          const shortlistPrompt = yield* renderProfileShortlistPrompt({
            job,
            locale: options.locale,
            profileSummaries,
          })
          profileShortlist = yield* advisor.shortlistProfiles({
            allowedProfiles: candidateProfiles,
            prompt: shortlistPrompt,
          })
        } else {
          yield* reportStepDetail(
            targetRoutine.recommend,
            `Using profile ${fixedProfile}`
          )
          yield* logInfo('Skipping profile shortlist pass', {
            profile: fixedProfile,
            reason: options.profile ? 'fixed profile' : 'single candidate',
          })
        }

        const requestedProfiles = fixedProfile
          ? [fixedProfile]
          : uniqueProfileSlugs(
              profileShortlist?.profileShortlist.map((item) => item.profile) ??
                []
            )

        yield* reportStepDetail(
          targetRoutine.recommend,
          `Rendering ${requestedProfiles.length} selected profile${requestedProfiles.length === 1 ? '' : 's'}`
        )
        yield* logInfo('Rendering requested full profile context', {
          jobHost: urlHost(job.url),
          requestedProfileCount: requestedProfiles.length,
          requestedProfiles: requestedProfiles.join(', '),
        })

        const profileMarkdown = yield* renderProfilesMarkdown({
          catalog: profileCatalog,
          locale: profileContextLocale,
          profiles: requestedProfiles,
        })
        const prompt = yield* renderRecommendationPrompt({
          fixedAudience: options.audience,
          fixedProfile,
          job,
          locale: options.locale,
          materialsMode: options.materials,
          profileMarkdown,
          profileShortlist,
        })

        yield* reportStepDetail(
          targetRoutine.recommend,
          'Preparing recommendation with Codex'
        )
        const rawRecommendation = yield* advisor.recommend({
          allowedProfiles: requestedProfiles,
          fixedProfile,
          prompt,
        })
        const recommendation = applyMaterialsMode(rawRecommendation, options)
        const decisions = resolveDecisions({ options, recommendation })

        yield* reportCampaignProgress(
          CampaignProgressEvent.TargetIdentified({
            company: recommendation.job.company,
            role: recommendation.job.role,
            targetIndex: target.index,
          })
        )
        yield* logInfo('Resolved campaign decisions', {
          audience: decisions.audience,
          jobHost: urlHost(target.url),
          profile: decisions.profile,
          recommendationConfidence: recommendation.recommendation.confidence,
        })

        return { decisions, recommendation }
      })
    )

    const generatedResult = yield* mintLink({
      decisions,
      options,
      targetRoutine,
    })

    return {
      decisions,
      generated: generatedResult.generated,
      issues: generatedResult.issues,
      job,
      outDir: target.outDir,
      recommendation,
      routine: targetRoutine,
      status: generatedResult.status,
      target,
    } satisfies CampaignDraft
  }).pipe(
    withTelemetrySpan('application-campaign.prepare-target', {
      jobHost: urlHost(targetRoutine.target.url),
      targetIndex: targetRoutine.target.index,
    })
  )
