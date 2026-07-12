import { Effect } from 'effect'
import { uniq } from 'es-toolkit'
import {
  renderProfileShortlistPrompt,
  renderRecommendationPrompt,
} from '../../ai/prompt'
import type { CampaignRecommendation } from '../../ai/schema'
import { fetchJobSource } from '../../job'
import {
  analysisExtensionSchemaFields,
  collectAnalysisPromptContributions,
  renderAnalysisExtensionInstructions,
} from '../../plugins/contributions'
import { uniqueProfileSlugs } from '../../profiles/catalog'
import { renderProfilesMarkdown } from '../../profiles/render-full'
import type { ApplicationCampaignRuntime } from '../../runtime'
import { logInfo, urlHost } from '../../telemetry'
import { slugify } from '../../text'
import { type WorkflowStep, workflowOutput } from '../graph'
import {
  targetAnalysisKey,
  targetDecisionsKey,
  targetJobKey,
  targetRecommendationKey,
} from '../keys'
import {
  CampaignProgressEvent,
  reportCampaignProgress,
  reportStepDetail,
} from '../progress'
import { campaignWorkflowStepIds, targetWorkflowStepId } from '../step-ids'
import type { CampaignDecisions } from '../types'
import type { TargetStepBuilderContext } from './model'

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
  recommendation: CampaignRecommendation,
  context: TargetStepBuilderContext
): CampaignRecommendation =>
  context.options.materials === 'all'
    ? recommendation
    : {
        ...recommendation,
        coverLetter: { body: '', subject: '' },
        email: { body: '', subject: '' },
      }

const resolveDecisions = (
  recommendation: CampaignRecommendation,
  context: TargetStepBuilderContext
): CampaignDecisions => ({
  audience:
    context.options.audience ??
    slugify(
      recommendation.recommendation.audienceSlug,
      slugify(recommendation.job.company, 'application')
    ),
  profile: context.options.profile ?? recommendation.recommendation.profile,
})

export const makeAnalysisSteps = (
  context: TargetStepBuilderContext
): readonly [
  WorkflowStep<ApplicationCampaignRuntime>,
  WorkflowStep<ApplicationCampaignRuntime>,
] => {
  const {
    advisor,
    candidateProfiles,
    options,
    plugins,
    profileCatalog,
    profileSummaries,
    targetRoutine,
  } = context
  const { target } = targetRoutine
  const id = (step: string) => targetWorkflowStepId(target.index, step)
  const fetchJob: WorkflowStep<ApplicationCampaignRuntime> = {
    execute: () =>
      fetchJobSource(target.url).pipe(
        Effect.map((job) => [workflowOutput(targetJobKey, job)])
      ),
    failurePolicy: 'fail-target',
    id: id(campaignWorkflowStepIds.target.fetchJob),
    label: 'Fetch job posting',
    scope: 'target',
  }
  const recommend: WorkflowStep<ApplicationCampaignRuntime> = {
    dependsOn: [
      fetchJob.id,
      ...uniq(
        plugins.analysisContributions.map((registration) =>
          id(registration.stepId)
        )
      ),
    ],
    execute: ({ outputs }) =>
      Effect.gen(function* () {
        const job = yield* outputs.get(targetJobKey)
        const fixedProfile = determinedProfile({
          candidateProfiles,
          fixedProfile: options.profile,
        })
        const contributions = collectAnalysisPromptContributions(
          outputs,
          plugins.analysisContributions
        )
        yield* reportStepDetail(
          targetRoutine.recommend,
          fixedProfile
            ? `Analyzing job and requesting fixed profile ${fixedProfile}`
            : 'Analyzing job and shortlisting candidate profiles with Codex'
        )
        const analysisPrompt = yield* renderProfileShortlistPrompt({
          extensionInstructions:
            renderAnalysisExtensionInstructions(contributions),
          fixedProfile,
          job,
          locale: options.locale,
          profileSummaries,
        })
        const analysis = yield* advisor.analyzeJob({
          allowedProfiles: candidateProfiles,
          extensionSchemas: analysisExtensionSchemaFields(contributions),
          fixedProfile,
          prompt: analysisPrompt,
        })
        const requestedProfiles = fixedProfile
          ? [fixedProfile]
          : uniqueProfileSlugs(
              analysis.profileShortlist.map((item) => item.profile)
            )
        yield* reportStepDetail(
          targetRoutine.recommend,
          `Rendering ${requestedProfiles.length} selected profile${requestedProfiles.length === 1 ? '' : 's'}`
        )
        const profileMarkdown = renderProfilesMarkdown({
          catalog: profileCatalog,
          locale: profileCatalog.defaultLocale,
          profiles: requestedProfiles,
        })
        const prompt = yield* renderRecommendationPrompt({
          fixedAudience: options.audience,
          fixedProfile,
          job,
          locale: options.locale,
          materialsMode: options.materials,
          profileMarkdown,
          profileShortlist: analysis,
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
        const recommendation = applyMaterialsMode(rawRecommendation, context)
        const decisions = resolveDecisions(recommendation, context)

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

        return [
          workflowOutput(targetAnalysisKey, analysis),
          workflowOutput(targetRecommendationKey, recommendation),
          workflowOutput(targetDecisionsKey, decisions),
          ...plugins.analysisContributions.flatMap((registration) =>
            Object.hasOwn(analysis.extensions, registration.name)
              ? [
                  workflowOutput(
                    registration.resultKey,
                    analysis.extensions[registration.name]
                  ),
                ]
              : []
          ),
        ]
      }),
    failurePolicy: 'fail-target',
    id: id(campaignWorkflowStepIds.target.recommend),
    label: 'Analyze job and prepare recommendation',
    scope: 'target',
  }

  return [fetchJob, recommend]
}
