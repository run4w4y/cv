import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import type { PrepareCampaignOptions } from '../config/model'
import {
  CampaignProfileSource,
  type CampaignProfileSourceService,
} from '../profiles/source'
import { prepareSharedCampaignInputs } from './profile-inputs'

const options = {
  concurrency: 1,
  contentRoot: '/profiles',
  excludedProfiles: ['default'],
  generate: false,
  locale: 'en',
  materials: 'all',
  outDir: '/output',
  pdfOutDir: '/pdfs',
  skipBuild: false,
  skipPdf: true,
  targets: [],
} satisfies PrepareCampaignOptions

describe('campaign profile source boundary', () => {
  test('loads authored layers using the source repository default locale', async () => {
    let openedRoot: string | undefined
    let loadedLocale: string | undefined
    let loadedProfiles: readonly string[] = []
    const source: CampaignProfileSourceService = {
      open: ({ contentRoot }) => {
        openedRoot = contentRoot

        return Effect.succeed({
          availableProfiles: {
            ru: ['default', 'custom-schema'],
          },
          defaultLocale: 'ru',
          defaultProfile: 'default',
          locales: ['ru'],
          profiles: ['default', 'custom-schema'],
          load: ({ locale, profiles }) => {
            loadedLocale = locale
            loadedProfiles = profiles

            return Effect.succeed({
              availableProfiles: {
                ru: ['default', 'custom-schema'],
              },
              content: {
                [locale]: {
                  'custom-schema': {
                    defaultProfile: 'default',
                    layers: [
                      {
                        profile: 'default',
                        sources: [
                          {
                            kind: 'mdx',
                            modulePath:
                              'content/profiles/default/ru/overview.mdx',
                            path: ['overview'],
                            source: 'Общая основа профиля',
                          },
                        ],
                      },
                      {
                        profile: 'custom-schema',
                        sources: [
                          {
                            kind: 'module',
                            modulePath:
                              'content/profiles/custom-schema/ru/platform.ts',
                            path: ['platform'],
                            source:
                              'export const focus = "Платформенная инженерия"',
                          },
                        ],
                      },
                    ],
                    locale,
                    profile: 'custom-schema',
                    sharedSources: [],
                  },
                },
              },
              defaultLocale: 'ru',
              defaultProfile: 'default',
              locales: ['ru'],
              profiles: ['default', 'custom-schema'],
            })
          },
        })
      },
    }

    const result = await Effect.runPromise(
      prepareSharedCampaignInputs({
        ...options,
        excludedProfiles: undefined,
      }).pipe(Effect.provideService(CampaignProfileSource, source))
    )

    expect(openedRoot).toBe('/profiles')
    expect(loadedLocale).toBe('ru')
    expect(loadedProfiles).toEqual(['custom-schema'])
    expect(result.candidateProfiles).toEqual(['custom-schema'])
    expect(result.excludedProfiles).toEqual(['default'])
    expect(result.profileSummaries).toContain('## custom-schema')
    expect(result.profileSummaries).toContain('Платформенная инженерия')
    expect(result.profileSummaries).not.toContain('Общая основа профиля')
  })

  test('preserves an explicit empty exclusion list', async () => {
    const source: CampaignProfileSourceService = {
      open: () =>
        Effect.succeed({
          availableProfiles: { en: ['base', 'specialist'] },
          defaultLocale: 'en',
          defaultProfile: 'base',
          locales: ['en'],
          profiles: ['base', 'specialist'],
          load: ({ locale }) =>
            Effect.succeed({
              availableProfiles: { en: ['base', 'specialist'] },
              content: {
                [locale]: {
                  base: {
                    defaultProfile: 'base',
                    layers: [
                      {
                        profile: 'base',
                        sources: [
                          {
                            kind: 'mdx',
                            modulePath: 'content/profiles/base/en/overview.mdx',
                            path: ['overview'],
                            source: 'Base profile source',
                          },
                        ],
                      },
                    ],
                    locale,
                    profile: 'base',
                    sharedSources: [],
                  },
                  specialist: {
                    defaultProfile: 'base',
                    layers: [
                      {
                        profile: 'base',
                        sources: [
                          {
                            kind: 'mdx',
                            modulePath: 'content/profiles/base/en/overview.mdx',
                            path: ['overview'],
                            source: 'Base profile source',
                          },
                        ],
                      },
                      {
                        profile: 'specialist',
                        sources: [
                          {
                            kind: 'module',
                            modulePath:
                              'content/profiles/specialist/en/overview.ts',
                            path: ['overview'],
                            source: 'Specialist overlay source',
                          },
                        ],
                      },
                    ],
                    locale,
                    profile: 'specialist',
                    sharedSources: [],
                  },
                },
              },
              defaultLocale: 'en',
              defaultProfile: 'base',
              locales: ['en'],
              profiles: ['base', 'specialist'],
            }),
        }),
    }

    const result = await Effect.runPromise(
      prepareSharedCampaignInputs({
        ...options,
        excludedProfiles: [],
      }).pipe(Effect.provideService(CampaignProfileSource, source))
    )

    expect(result.candidateProfiles).toEqual(['base', 'specialist'])
    expect(result.excludedProfiles).toEqual([])
    expect(result.profileSummaries).toContain('Base profile source')
    expect(result.profileSummaries).toContain('Specialist overlay source')
  })
})
