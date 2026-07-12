import { describe, expect, test } from 'bun:test'
import { contentManifestSchemaVersion } from '@cv/content-core'
import { Schema } from 'effect'
import { type ContentContract, composeContent } from './compose'
import type { ContentRegistry } from './content-registry/types'

const registry: ContentRegistry = {
  mdxModules: {},
  modules: {
    'content.config.ts': {
      default: {
        contentDir: 'content',
        defaultLocale: 'en',
        defaultProfile: 'default',
        locales: ['en'],
        publicProfiles: ['default'],
      },
    },
    'content/profiles/default/en/profile.ts': { default: {} },
  },
}

const contractFor = (
  contentSchema: Schema.Codec<unknown, unknown>,
  value: unknown,
  profiles: readonly string[] = ['default']
): ContentContract<unknown> => ({
  authoringModule: '/content-authoring.ts',
  compose: () => ({
    manifest: {
      content: { en: { default: value } },
      locales: ['en'],
      profiles,
    },
  }),
  contentSchema,
  contentSchemaVersion: 'test.content.v1',
})

describe('content contract', () => {
  test('stamps protocol/content versions and preserves valid falsy content', () => {
    const result = composeContent(registry, contractFor(Schema.Boolean, false))

    expect(result.manifest.schema).toBe(contentManifestSchemaVersion)
    expect(result.manifest.contentSchema).toBe('test.content.v1')
    expect(result.manifest.content.en?.default).toBe(false)
  })

  test('enforces the app-owned runtime content schema', () => {
    expect(() =>
      composeContent(registry, contractFor(Schema.Literal('valid'), 'invalid'))
    ).toThrow()
  })

  test('rejects content that cannot cross the JSON boundary', () => {
    expect(() =>
      composeContent(registry, contractFor(Schema.Unknown, 1n))
    ).toThrow('not JSON-serializable')

    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic

    expect(() =>
      composeContent(registry, contractFor(Schema.Unknown, cyclic))
    ).toThrow('cyclic reference')
  })

  test('rejects manifest arrays that do not describe the content records', () => {
    expect(() =>
      composeContent(
        registry,
        contractFor(Schema.Unknown, {}, ['default', 'missing'])
      )
    ).toThrow('no content for declared profile "missing"')
  })
})
