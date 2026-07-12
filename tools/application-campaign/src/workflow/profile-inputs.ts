import { Effect } from 'effect'
import type { PrepareCampaignOptions } from '../config/model'
import { ApplicationCampaignConfigError } from '../errors'
import type { ProfileCatalog as LoadedProfileCatalog } from '../profiles/catalog'
import { excludeProfileSlugs, profileSlugsForLocale } from '../profiles/catalog'
import { renderProfileSummariesMarkdown } from '../profiles/render-summary'
import { CampaignProfileSource } from '../profiles/source'
import { logInfo } from '../telemetry'

export type ProfileCatalog = LoadedProfileCatalog

export type SharedCampaignInputs = {
  readonly candidateProfiles: readonly string[]
  readonly excludedProfiles: readonly string[]
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
          message: `No ${locale} content profiles are available after exclusions. Excluded profiles: ${excludedProfiles.join(', ') || '(none)'}.`,
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
    const source = yield* CampaignProfileSource
    const discoveredCatalog = yield* source.open({
      contentRoot: options.contentRoot,
    })
    const contextLocale = discoveredCatalog.defaultLocale
    const excludedProfiles = options.excludedProfiles ?? [
      discoveredCatalog.defaultProfile,
    ]
    const localeProfiles = profileSlugsForLocale(discoveredCatalog)
    const selectableProfiles = excludeProfileSlugs(
      localeProfiles,
      excludedProfiles
    )
    const candidateProfiles = yield* resolveCampaignProfiles({
      selectableProfiles,
      excludedProfiles,
      fixedProfile: options.profile,
      locale: contextLocale,
    })

    const profileCatalog = yield* discoveredCatalog.load({
      locale: contextLocale,
      profiles: candidateProfiles,
    })

    yield* logInfo('Loaded campaign profile inputs', {
      candidateProfileCount: candidateProfiles.length,
      contentLocaleCount: profileCatalog.locales.length,
      excludedProfileCount: excludedProfiles.length,
      contentLocale: contextLocale,
      localeProfileCount: localeProfiles.length,
      selectableProfileCount: selectableProfiles.length,
    })

    const profileSummaries = renderProfileSummariesMarkdown({
      catalog: profileCatalog,
      locale: contextLocale,
      profiles: candidateProfiles,
    })

    return {
      candidateProfiles,
      excludedProfiles,
      profileCatalog,
      profileSummaries,
    }
  })
