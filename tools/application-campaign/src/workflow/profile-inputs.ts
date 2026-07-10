import { Effect } from 'effect'
import type { PrepareCampaignOptions } from '../config/model'
import { ApplicationCampaignConfigError } from '../errors'
import {
  discoverProfileCatalog,
  excludeProfileSlugs,
  profileContextLocale,
  profileSlugsForLocale,
} from '../profiles/catalog'
import { renderProfileSummariesMarkdown } from '../profiles/render-summary'
import type { ResolvedProfileCatalog } from '../profiles/variables'
import { resolveProfileVariables } from '../profiles/variables'
import { logInfo } from '../telemetry'

export type ProfileCatalog = ResolvedProfileCatalog

export type SharedCampaignInputs = {
  readonly candidateProfiles: readonly string[]
  readonly profileCatalog: ProfileCatalog
  readonly profileSummaries: string
}

const resolveCampaignProfiles = ({
  selectableProfiles,
  excludedProfiles,
  fixedProfile,
  locale,
}: {
  readonly selectableProfiles: readonly string[]
  readonly excludedProfiles: readonly string[]
  readonly fixedProfile?: string
  readonly locale: string
}) =>
  Effect.gen(function* () {
    const selectableProfileNames = new Set(selectableProfiles)
    const excludedProfileNames = new Set(excludedProfiles)

    if (fixedProfile && excludedProfileNames.has(fixedProfile)) {
      return yield* Effect.fail(
        new ApplicationCampaignConfigError({
          message: `Profile "${fixedProfile}" is excluded. Remove it from --exclude-profiles or choose another profile.`,
        })
      )
    }

    if (selectableProfiles.length === 0) {
      return yield* Effect.fail(
        new ApplicationCampaignConfigError({
          message: `No ${locale} CV profiles are available after exclusions. Excluded profiles: ${excludedProfiles.join(', ') || '(none)'}.`,
        })
      )
    }

    if (fixedProfile && !selectableProfileNames.has(fixedProfile)) {
      return yield* Effect.fail(
        new ApplicationCampaignConfigError({
          message: `Profile "${fixedProfile}" is not available in ${locale} campaign context. Selectable profiles: ${selectableProfiles.join(', ')}.`,
        })
      )
    }

    return fixedProfile ? [fixedProfile] : selectableProfiles
  })

export const prepareSharedCampaignInputs = (options: PrepareCampaignOptions) =>
  Effect.gen(function* () {
    const discoveredCatalog = yield* discoverProfileCatalog(options.contentRoot)
    const localeProfiles = profileSlugsForLocale(
      discoveredCatalog,
      profileContextLocale
    )
    const selectableProfiles = excludeProfileSlugs(
      localeProfiles,
      options.excludedProfiles
    )
    const candidateProfiles = yield* resolveCampaignProfiles({
      selectableProfiles,
      excludedProfiles: options.excludedProfiles,
      fixedProfile: options.profile,
      locale: profileContextLocale,
    })

    const profileCatalog = yield* resolveProfileVariables({
      catalog: discoveredCatalog,
      locale: profileContextLocale,
      profiles: candidateProfiles,
    })

    yield* logInfo('Loaded campaign profile inputs', {
      candidateProfileCount: candidateProfiles.length,
      contentLocaleCount: profileCatalog.locales.length,
      excludedProfileCount: options.excludedProfiles.length,
      localeProfileCount: localeProfiles.length,
      profileContextLocale,
      selectableProfileCount: selectableProfiles.length,
    })

    const profileSummaries = yield* renderProfileSummariesMarkdown({
      catalog: profileCatalog,
      locale: profileContextLocale,
      profiles: candidateProfiles,
    })

    return {
      candidateProfiles,
      profileCatalog,
      profileSummaries,
    }
  })
