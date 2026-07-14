import { Effect } from 'effect'
import type { CampaignMaterialsMode } from '../config/model'
import type { JobSource } from '../job'
import { logDebug, logInfo, urlHost, withTelemetrySpan } from '../telemetry'
import { renderTemplate } from '../template'
import type { CampaignProfileShortlist } from './schema'

const profileShortlistPromptTemplateName = 'profile-shortlist-prompt.md.hbs'
const recommendationPromptTemplateName = 'recommendation-prompt.md.hbs'

type PromptJobContext = {
  readonly body: string
  readonly contentType: string
  readonly fetchedAt: string
  readonly url: string
}

type ProfileShortlistPromptContext = {
  readonly extensionInstructions: string
  readonly job: PromptJobContext
  readonly locale: string
  readonly profileInstruction: string
  readonly profiles: string
}

type RecommendationPromptContext = {
  readonly audienceInstruction: string
  readonly job: PromptJobContext
  readonly jobAnalysis: string
  readonly locale: string
  readonly materialsInstruction: string
  readonly extensionInstructions: string
  readonly profileInstruction: string
  readonly profileShortlist: string
  readonly profiles: string
}

const promptJobContext = (job: JobSource): PromptJobContext => ({
  body: job.body,
  contentType: job.contentType ?? 'unknown',
  fetchedAt: job.fetchedAt,
  url: job.url,
})

const shortlistProfileInstruction = (fixedProfile: string | undefined) =>
  fixedProfile
    ? `Request only the fixed profile "${fixedProfile}". Do not request any other profile.`
    : 'Request the profile or profiles whose full authored source context you need for the final decision. Prefer 1-3 profiles; include more only when the compact contexts are genuinely ambiguous.'

const recommendationProfileInstruction = (fixedProfile: string | undefined) =>
  fixedProfile
    ? `Use the fixed profile "${fixedProfile}". Do not select another profile.`
    : 'Select the single best profile from the full profile contexts supplied below.'

const audienceInstruction = (fixedAudience: string | undefined) =>
  fixedAudience
    ? `Use the fixed audience slug "${fixedAudience}".`
    : 'Suggest audienceSlug as a short lower-case kebab-case slug based only on the company name.'

const recommendationMaterialsInstruction = (mode: CampaignMaterialsMode) =>
  mode === 'none'
    ? 'Do not draft applicant-facing cover letter or email text for this run. Return empty strings for coverLetter.subject, coverLetter.body, email.subject, and email.body while still returning the internal job analysis, recommendation, matched evidence, and follow-up questions.'
    : 'Draft the applicant-facing cover letter and email according to the writing rules below.'

export const renderProfileShortlistPrompt = ({
  extensionInstructions,
  fixedProfile,
  job,
  locale,
  profileSummaries,
}: {
  readonly extensionInstructions?: string
  readonly fixedProfile?: string
  readonly job: JobSource
  readonly locale: string
  readonly profileSummaries: string
}) =>
  Effect.gen(function* () {
    yield* logInfo('Rendering profile shortlist prompt', {
      hasFixedProfile: Boolean(fixedProfile),
      jobHost: urlHost(job.url),
      locale,
      profileContextChars: profileSummaries.length,
    })

    const context = {
      extensionInstructions:
        extensionInstructions?.trim() ||
        'No campaign plugins requested additional job fields. Return an empty extensions object.',
      job: promptJobContext(job),
      locale,
      profileInstruction: shortlistProfileInstruction(fixedProfile),
      profiles: profileSummaries,
    } satisfies ProfileShortlistPromptContext
    const prompt = yield* renderTemplate({
      context,
      purpose: 'prompt',
      templateName: profileShortlistPromptTemplateName,
    })

    yield* logDebug('Rendered profile shortlist prompt', {
      jobBodyChars: context.job.body.length,
      profileContextChars: profileSummaries.length,
      promptChars: prompt.length,
    })

    return prompt
  }).pipe(
    withTelemetrySpan('application-campaign.prompt.shortlist.render', {
      hasFixedProfile: Boolean(fixedProfile),
      jobHost: urlHost(job.url),
      locale,
    })
  )

export const renderRecommendationPrompt = ({
  fixedAudience,
  fixedProfile,
  job,
  locale,
  materialsMode,
  profileMarkdown,
  profileShortlist,
  extensionInstructions,
}: {
  readonly fixedAudience?: string
  readonly fixedProfile?: string
  readonly job: JobSource
  readonly locale: string
  readonly materialsMode: CampaignMaterialsMode
  readonly profileMarkdown: string
  readonly profileShortlist?: CampaignProfileShortlist
  readonly extensionInstructions?: string
}) =>
  Effect.gen(function* () {
    yield* logInfo('Rendering final recommendation prompt', {
      hasFixedAudience: Boolean(fixedAudience),
      hasFixedProfile: Boolean(fixedProfile),
      jobHost: urlHost(job.url),
      locale,
      materialsMode,
      profileContextChars: profileMarkdown.length,
      requestedProfileCount: profileShortlist?.profileShortlist.length ?? 1,
    })

    const context = {
      audienceInstruction: audienceInstruction(fixedAudience),
      job: promptJobContext(job),
      jobAnalysis: profileShortlist
        ? JSON.stringify(profileShortlist.job, null, 2)
        : 'No separate first-pass analysis was needed because the profile was already determined. Analyze the full posting directly in this pass.',
      locale,
      materialsInstruction: recommendationMaterialsInstruction(materialsMode),
      extensionInstructions:
        extensionInstructions?.trim() ||
        'No campaign plugins requested final recommendation fields. Return an empty extensions object.',
      profileInstruction: recommendationProfileInstruction(fixedProfile),
      profiles: profileMarkdown,
      profileShortlist: profileShortlist
        ? JSON.stringify(profileShortlist.profileShortlist, null, 2)
        : 'No shortlist was needed; one fixed or available profile is supplied below.',
    } satisfies RecommendationPromptContext
    const prompt = yield* renderTemplate({
      context,
      purpose: 'prompt',
      templateName: recommendationPromptTemplateName,
    })

    yield* logDebug('Rendered final recommendation prompt', {
      jobBodyChars: context.job.body.length,
      profileContextChars: profileMarkdown.length,
      promptChars: prompt.length,
      requestedProfileCount: profileShortlist?.profileShortlist.length ?? 1,
    })

    return prompt
  }).pipe(
    withTelemetrySpan('application-campaign.prompt.recommendation.render', {
      hasFixedAudience: Boolean(fixedAudience),
      hasFixedProfile: Boolean(fixedProfile),
      jobHost: urlHost(job.url),
      locale,
    })
  )
