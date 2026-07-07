import { describe, expect, test } from 'bun:test'
import type { ContentRegistry } from './content-registry/types'
import { loadContentRepository } from './repository'

const component = () => null

const registry = ({
  mdxModules = {},
  modules = {},
}: Partial<ContentRegistry>): ContentRegistry => ({
  mdxModules,
  modules,
})

const fallback = {
  defaultLocale: 'en',
  defaultProfile: 'default',
} as const

describe('content repository discovery', () => {
  test('loads configured locales, discovers profiles, and indexes source/effective sections', () => {
    const repository = loadContentRepository(
      registry({
        mdxModules: {
          'content/profiles/backend/en/experience/acme.mdx': {
            default: component,
          },
          'content/profiles/default/en/experience/acme.mdx': {
            default: component,
          },
        },
        modules: {
          'content.config.ts': {
            default: {
              contentDir: 'content',
              locales: ['en', 'ru'],
              publicProfiles: ['default'],
            },
          },
          'content/profiles/backend/en/projects/cv.ts': {
            default: {},
          },
          'content/profiles/backend/en/education/innopolis.ts': {
            default: {},
          },
          'content/profiles/default/en/about.ts': {
            default: {},
          },
          'content/profiles/default/en/education.ts': {
            default: {},
          },
          'content/profiles/default/en/experience/index.tsx': {
            default: {},
          },
          'content/profiles/default/ru/about.ts': {
            default: {},
          },
        },
      }),
      fallback
    )

    expect(repository.config.locales).toEqual(['en', 'ru'])
    expect(repository.config.publicProfiles).toEqual(['default'])
    expect(repository.profiles).toEqual(['backend', 'default'])
    expect(
      repository
        .listSourceChildren('en', 'default', [])
        .map((section) => section.path.join('/'))
    ).toEqual(['about', 'education', 'experience'])
    expect(
      repository.getEffectiveSection('en', 'backend', ['about'])
    ).toMatchObject({
      modulePath: 'content/profiles/default/en/about.ts',
      profile: 'backend',
      sourceProfile: 'default',
    })
    expect(
      repository
        .listSourceChildren('en', 'backend', ['experience'])
        .map((section) => ({
          modulePath: section.modulePath,
          profile: section.profile,
          sourceProfile: section.sourceProfile,
        }))
    ).toEqual([
      {
        modulePath: 'content/profiles/backend/en/experience/acme.mdx',
        profile: 'backend',
        sourceProfile: 'backend',
      },
    ])
    expect(
      repository.getEffectiveSection('en', 'backend', ['education'])
    ).toMatchObject({
      modulePath: 'content/profiles/default/en/education.ts',
      profile: 'backend',
      sourceProfile: 'default',
    })
  })

  test('rejects files that resolve to the same section path', () => {
    expect(() =>
      loadContentRepository(
        registry({
          mdxModules: {
            'content/profiles/default/en/about/index.mdx': {
              default: component,
            },
          },
          modules: {
            'content.config.ts': {
              default: {
                contentDir: 'content',
                locales: ['en'],
              },
            },
            'content/profiles/default/en/about.ts': {
              default: {},
            },
          },
        }),
        fallback
      )
    ).toThrow('Duplicate content section "about"')
  })

  test('ignores generated support files but preserves underscored sections', () => {
    const repository = loadContentRepository(
      registry({
        modules: {
          'content.config.ts': {
            default: {
              contentDir: 'content',
              locales: ['en'],
            },
          },
          'content/profiles/default/en/_summary.ts': {
            default: {},
          },
          'content/profiles/default/en/about.spec.ts': {
            default: {},
          },
          'content/profiles/default/en/about.ts': {
            default: {},
          },
          'content/profiles/default/en/profile.d.ts': {
            default: {},
          },
          'content/profiles/default/en/profile.ts': {
            default: {},
          },
        },
      }),
      fallback
    )

    expect(
      repository
        .listSourceChildren('en', 'default', [])
        .map((section) => section.path.join('/'))
    ).toEqual(['_summary', 'about', 'profile'])
  })

  test('requires the default profile in the default locale', () => {
    expect(() =>
      loadContentRepository(
        registry({
          modules: {
            'content.config.ts': {
              default: {
                contentDir: 'content',
                locales: ['en'],
              },
            },
            'content/profiles/backend/en/profile.ts': {
              default: {},
            },
          },
        }),
        fallback
      )
    ).toThrow(
      'Default content profile "default" was not discovered for locale "en"'
    )
  })

  test('requires a root content repository config', () => {
    expect(() =>
      loadContentRepository(
        registry({
          modules: {
            'content/profiles/default/en/profile.ts': {
              default: {},
            },
          },
        }),
        fallback
      )
    ).toThrow('Missing content source module content.config')
  })
})
