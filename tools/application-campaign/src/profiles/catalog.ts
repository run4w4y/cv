import { loadContentSource } from '@cv/content-astro/loader'
import { cvContentContract } from '@cv/cv/content-contract'
import type { CvContent } from '@cv/cv/content-model'
import { Effect } from 'effect'
import { ApplicationCampaignContentError } from '../errors'
import { logDebug, logInfo, withTelemetrySpan } from '../telemetry'

type CvContentSource = Awaited<ReturnType<typeof loadContentSource<CvContent>>>

export const profileCatalogFromSource = ({
  manifest,
  variableSource,
}: CvContentSource) => ({
  content: manifest.content,
  locales: manifest.locales,
  profiles: manifest.profiles,
  variableSource,
})

export type ProfileCatalog = ReturnType<typeof profileCatalogFromSource>

export const profileContextLocale = 'en'

export const profileSlugsWithContent = (catalog: ProfileCatalog) =>
  catalog.profiles.filter((profile) =>
    catalog.locales.some((locale) =>
      Boolean(catalog.content[locale]?.[profile])
    )
  )

export const profileSlugsForLocale = (
  catalog: ProfileCatalog,
  locale = profileContextLocale
) =>
  catalog.profiles.filter((profile) =>
    Boolean(catalog.content[locale]?.[profile])
  )

export const excludeProfileSlugs = (
  profiles: readonly string[],
  excludedProfiles: readonly string[]
) => {
  const excluded = new Set(excludedProfiles)

  return profiles.filter((profile) => !excluded.has(profile))
}

export const uniqueProfileSlugs = (profiles: readonly string[]) => [
  ...new Set(profiles),
]

export const discoverProfileCatalog = (contentRoot: string) =>
  Effect.gen(function* () {
    yield* logInfo('Composing CV profile catalog')

    const source = yield* Effect.tryPromise({
      try: () =>
        loadContentSource({
          contentRoot,
          contract: cvContentContract,
        }),
      catch: (cause) =>
        new ApplicationCampaignContentError({
          cause,
          message: `Could not compose CV content from ${contentRoot}`,
        }),
    })
    const catalog = profileCatalogFromSource(source)
    const profiles = profileSlugsWithContent(catalog)

    yield* logDebug('Composed CV profile catalog', {
      hasPrivateVariableSource: Boolean(catalog.variableSource),
      localeCount: catalog.locales.length,
      profileCount: profiles.length,
    })

    if (profiles.length === 0) {
      return yield* Effect.fail(
        new ApplicationCampaignContentError({
          message: `No profiles discovered in composed CV content from ${contentRoot}`,
        })
      )
    }

    return catalog
  }).pipe(withTelemetrySpan('application-campaign.profiles.discover'))
