import { Effect, Schema } from 'effect'
import { ApplicationCampaignValidationError } from '../errors'
import {
  type CampaignJobAnalysis,
  type CampaignProfileShortlist,
  CampaignProfileShortlistSchema,
  type CampaignRecommendation,
  CampaignRecommendationSchema,
} from './schema'

export type ProfileSelectionValidationContext = {
  readonly allowedProfiles: readonly string[]
  readonly fixedProfile?: string
}

const decodeCampaignRecommendationJson = Schema.decodeUnknownEffect(
  Schema.fromJsonString(CampaignRecommendationSchema),
  { errors: 'all' }
)

const decodeCampaignProfileShortlistJson = Schema.decodeUnknownEffect(
  Schema.fromJsonString(CampaignProfileShortlistSchema),
  { errors: 'all' }
)

const failValidation = (message: string, cause?: unknown) =>
  Effect.fail(new ApplicationCampaignValidationError({ cause, message }))

const validateProfile = (
  profile: string,
  profileNames: ReadonlySet<string>,
  context: string
) =>
  profileNames.has(profile)
    ? Effect.void
    : failValidation(
        `${context} selected unknown profile "${profile}". Allowed profiles: ${[
          ...profileNames,
        ].join(', ')}`
      )

const validateFixedProfile = (
  recommendation: CampaignRecommendation,
  fixedProfile: string | undefined
) =>
  fixedProfile && recommendation.recommendation.profile !== fixedProfile
    ? failValidation(
        `Codex selected profile "${recommendation.recommendation.profile}" but --profile fixed the campaign to "${fixedProfile}".`
      )
    : Effect.void

const validateFixedProfileShortlist = (
  shortlist: CampaignProfileShortlist,
  fixedProfile: string | undefined
) =>
  fixedProfile &&
  !shortlist.profileShortlist.some((item) => item.profile === fixedProfile)
    ? failValidation(
        `Codex did not request fixed profile "${fixedProfile}" for full profile context.`
      )
    : Effect.void

export const validateCampaignProfileShortlist = (
  shortlist: CampaignProfileShortlist,
  { allowedProfiles, fixedProfile }: ProfileSelectionValidationContext
) =>
  Effect.gen(function* () {
    const profileNames = new Set(allowedProfiles)

    if (shortlist.profileShortlist.length === 0) {
      return yield* failValidation(
        'Codex did not request any profiles for full profile context.'
      )
    }

    yield* Effect.forEach(
      shortlist.profileShortlist,
      (item) =>
        validateProfile(item.profile, profileNames, 'Profile shortlist'),
      { discard: true }
    )
    yield* validateFixedProfileShortlist(shortlist, fixedProfile)

    return shortlist
  })

export const validateCampaignRecommendation = (
  recommendation: CampaignRecommendation,
  { allowedProfiles, fixedProfile }: ProfileSelectionValidationContext
) =>
  Effect.gen(function* () {
    const profileNames = new Set(allowedProfiles)

    if (
      !Number.isFinite(recommendation.recommendation.confidence) ||
      recommendation.recommendation.confidence < 0 ||
      recommendation.recommendation.confidence > 1
    ) {
      return yield* failValidation(
        'Recommendation confidence must be a number between 0 and 1.'
      )
    }

    yield* validateProfile(
      recommendation.recommendation.profile,
      profileNames,
      'Recommendation'
    )
    yield* validateFixedProfile(recommendation, fixedProfile)
    yield* Effect.forEach(
      recommendation.recommendation.alternatives,
      (alternative) =>
        validateProfile(alternative.profile, profileNames, 'Alternative'),
      { discard: true }
    )

    return recommendation
  })

export const parseCampaignRecommendationEffect = (
  raw: string,
  context: ProfileSelectionValidationContext
) =>
  decodeCampaignRecommendationJson(raw).pipe(
    Effect.mapError(
      (cause) =>
        new ApplicationCampaignValidationError({
          cause,
          message: 'Could not decode campaign recommendation',
        })
    ),
    Effect.flatMap((recommendation) =>
      validateCampaignRecommendation(recommendation, context)
    )
  )

export const parseCampaignProfileShortlistEffect = (
  raw: string,
  context: ProfileSelectionValidationContext
) =>
  decodeCampaignProfileShortlistJson(raw).pipe(
    Effect.mapError(
      (cause) =>
        new ApplicationCampaignValidationError({
          cause,
          message: 'Could not decode campaign profile shortlist',
        })
    ),
    Effect.flatMap((shortlist) =>
      validateCampaignProfileShortlist(shortlist, context)
    )
  )

export const validateCampaignJobAnalysis = (
  analysis: CampaignJobAnalysis,
  context: ProfileSelectionValidationContext
) =>
  validateCampaignProfileShortlist(analysis, context).pipe(Effect.as(analysis))
