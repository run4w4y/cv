import { openContentSourceRepository } from '@cv/content-astro/source'
import { Effect } from 'effect'
import { ApplicationCampaignContentError } from '../../errors'
import type { CampaignProfileSourceService } from '../../profiles/source'

const contentError = (message: string, cause?: unknown) =>
  new ApplicationCampaignContentError({ cause, message })

export const makeRepositoryCampaignProfileSource =
  (): CampaignProfileSourceService => ({
    open: ({ contentRoot }) =>
      Effect.gen(function* () {
        const repository = yield* Effect.tryPromise({
          try: () => openContentSourceRepository({ contentRoot }),
          catch: (cause) =>
            contentError(
              `Could not open the authored content repository at ${contentRoot}.`,
              cause
            ),
        })
        const catalogIndex = {
          availableProfiles: repository.availableProfiles,
          defaultLocale: repository.config.defaultLocale,
          defaultProfile: repository.config.defaultProfile,
          locales: repository.config.locales,
          profiles: repository.profiles,
        }

        return {
          ...catalogIndex,
          load: ({ locale, profiles }) =>
            Effect.gen(function* () {
              const available = new Set(
                repository.availableProfiles[locale] ?? []
              )
              const unavailable = profiles.find(
                (profile) => !available.has(profile)
              )

              if (unavailable) {
                return yield* contentError(
                  `No ${locale} content is available for profile "${unavailable}".`
                )
              }

              const entries = yield* Effect.forEach(
                profiles,
                (profile) =>
                  Effect.tryPromise({
                    try: () =>
                      repository.loadProfileSources({ locale, profile }),
                    catch: (cause) =>
                      contentError(
                        `Could not load authored content for ${locale}/${profile}.`,
                        cause
                      ),
                  }).pipe(Effect.map((content) => [profile, content] as const)),
                { concurrency: 'unbounded' }
              )

              return {
                ...catalogIndex,
                content: {
                  [locale]: Object.fromEntries(entries),
                },
              }
            }),
        }
      }),
  })

export const RepositoryCampaignProfileSource =
  makeRepositoryCampaignProfileSource()
