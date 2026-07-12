import { describe, expect, test } from 'bun:test'
import type { ProfileCatalog } from './catalog'
import { renderProfilesMarkdown } from './render-full'
import {
  profileSummaryCharacterBudget,
  renderJsonMarkdown,
} from './render-shared'
import { renderProfileSummariesMarkdown } from './render-summary'

const source = (
  modulePath: string,
  contents: string,
  path: readonly string[] = ['overview']
) => ({
  kind: modulePath.endsWith('.mdx') ? ('mdx' as const) : ('module' as const),
  modulePath,
  path,
  source: contents,
})

const layeredProfile = ({
  baseSource = 'Base profile evidence',
  overlaySource = 'Backend overlay evidence',
  profile = 'backend',
}: {
  readonly baseSource?: string
  readonly overlaySource?: string
  readonly profile?: string
} = {}) => ({
  defaultProfile: 'base',
  layers: [
    {
      profile: 'base',
      sources: [source('content/profiles/base/en/overview.mdx', baseSource)],
    },
    ...(profile === 'base'
      ? []
      : [
          {
            profile,
            sources: [
              source(
                `content/profiles/${profile}/en/overview.ts`,
                overlaySource
              ),
            ],
          },
        ]),
  ],
  locale: 'en',
  profile,
  sharedSources: [
    {
      modulePath: 'content/shared/skills.ts',
      source: 'export const sharedSkill = "Distributed systems"',
    },
  ],
})

const catalog = (content: Record<string, unknown>): ProfileCatalog => ({
  availableProfiles: { en: Object.keys(content) },
  content: { en: content },
  defaultLocale: 'en',
  defaultProfile: 'base',
  locales: ['en'],
  profiles: Object.keys(content),
})

describe('generic profile source markdown', () => {
  test('renders the selected overlay only in compact contexts', () => {
    const profileCatalog = catalog({ backend: layeredProfile() })
    const summary = renderProfileSummariesMarkdown({
      catalog: profileCatalog,
      locale: 'en',
      profiles: ['backend'],
    })

    expect(summary).toContain('Authored layer: backend')
    expect(summary).toContain('Backend overlay evidence')
    expect(summary).toContain('content/profiles/backend/en/overview.ts')
    expect(summary).not.toContain('Base profile evidence')
    expect(summary).not.toContain('Distributed systems')
  })

  test('falls back to the base layer when there is no authored overlay', () => {
    const profileCatalog = catalog({
      base: layeredProfile({ profile: 'base' }),
    })
    const summary = renderProfileSummariesMarkdown({
      catalog: profileCatalog,
      locale: 'en',
      profiles: ['base'],
    })

    expect(summary).toContain('Authored layer: base')
    expect(summary).toContain('Base profile evidence')
  })

  test('renders shared sources once followed by every full profile layer', () => {
    const profileCatalog = catalog({
      backend: layeredProfile(),
      platform: layeredProfile({
        overlaySource: 'Platform overlay evidence',
        profile: 'platform',
      }),
    })
    const full = renderProfilesMarkdown({
      catalog: profileCatalog,
      locale: 'en',
      profiles: ['backend', 'platform'],
    })

    expect(full.match(/Shared authored sources/gu)).toHaveLength(1)
    expect(full.match(/Distributed systems/gu)).toHaveLength(1)
    expect(full.match(/Base profile evidence/gu)).toHaveLength(2)
    expect(full).toContain('Backend overlay evidence')
    expect(full).toContain('Platform overlay evidence')
  })

  test('bounds each compact profile after rendering', () => {
    const oversized = `${'x'.repeat(profileSummaryCharacterBudget)}tail`
    const profileCatalog = catalog({
      backend: layeredProfile({ overlaySource: oversized }),
    })
    const summary = renderProfileSummariesMarkdown({
      catalog: profileCatalog,
      locale: 'en',
      profiles: ['backend'],
    })

    expect(summary).toContain('source characters were omitted')
    expect(summary).not.toContain('tail')
    expect(summary.length).toBeLessThanOrEqual(profileSummaryCharacterBudget)
  })

  test('bounds compact context including paths, headings, and fences', () => {
    const profile = layeredProfile()
    const profileCatalog = catalog({
      backend: {
        ...profile,
        layers: [
          profile.layers[0],
          {
            profile: 'backend',
            sources: Array.from({ length: 1_000 }, (_, index) =>
              source(`content/profiles/backend/en/evidence/${index}.mdx`, 'x', [
                'evidence',
                String(index),
              ])
            ),
          },
        ],
      },
    })
    const summary = renderProfileSummariesMarkdown({
      catalog: profileCatalog,
      locale: 'en',
      profiles: ['backend'],
    })

    expect(summary.length).toBeLessThanOrEqual(profileSummaryCharacterBudget)
    expect(summary).toContain('source characters were omitted')
  })

  test('uses a fence longer than any backtick run in authored source', () => {
    const embeddedFence = 'const example = `docs with ```` inside`'
    const profileCatalog = catalog({
      backend: layeredProfile({ overlaySource: embeddedFence }),
    })
    const summary = renderProfileSummariesMarkdown({
      catalog: profileCatalog,
      locale: 'en',
      profiles: ['backend'],
    })

    expect(summary).toContain(`\`\`\`\`\`ts\n${embeddedFence}\n\`\`\`\`\``)
  })

  test('retains an opaque JSON fallback without knowing its schema', () => {
    const arbitraryProfile = {
      active: true,
      history: [{ evidence: ['Built a scheduler'] }],
    }

    expect(renderJsonMarkdown(arbitraryProfile)).toBe(
      `\`\`\`json\n${JSON.stringify(arbitraryProfile, null, 2)}\n\`\`\``
    )
  })

  test('renders falsy opaque roots instead of treating them as missing', () => {
    const profiles = ['false', 'zero', 'empty', 'null']
    const profileCatalog = catalog({
      empty: '',
      false: false,
      null: null,
      zero: 0,
    })
    const full = renderProfilesMarkdown({
      catalog: profileCatalog,
      locale: 'en',
      profiles,
    })
    const summary = renderProfileSummariesMarkdown({
      catalog: profileCatalog,
      locale: 'en',
      profiles,
    })

    for (const markdown of [full, summary]) {
      expect(markdown).not.toContain('No en content is available')
      expect(markdown).toContain('false')
      expect(markdown).toContain('0')
      expect(markdown).toContain('null')
    }
  })
})
