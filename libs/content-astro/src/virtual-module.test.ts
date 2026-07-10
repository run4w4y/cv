import { describe, expect, test } from 'bun:test'
import type { ContentArtifacts } from '@cv/content-build'
import { runEffectPromise } from './node-runtime'
import {
  createContentPrivateRuntimeProfileVirtualModuleSource,
  createContentRuntimeVirtualModuleSource,
  createContentVirtualModuleSource,
} from './virtual-module'

const artifacts = {
  fileIndex: {
    profiles: {},
    public: [],
  },
  filePlan: {
    contentIdSalt: 'test-salt',
    files: [],
    privateRuntimeInput: null,
  },
  privateManifest: {
    generatedAt: '2026-01-01T00:00:00.000Z',
    profiles: [
      {
        id: 'p_hiring',
        locale: 'en',
        payload: {
          alg: 'AES-GCM',
          ciphertext: 'encrypted-hiring',
          compression: 'gzip',
          iv: 'iv-hiring',
        },
        profile: 'hiring',
        selector: 'abc123____0',
      },
      {
        id: 'p_sales',
        locale: 'en',
        payload: {
          alg: 'AES-GCM',
          ciphertext: 'encrypted-sales',
          compression: 'gzip',
          iv: 'iv-sales',
        },
        profile: 'sales',
        selector: 'abc123____1',
      },
    ],
    schema: 'private-content.runtime.v1',
    version: 1,
  },
  snapshot: {
    contentIdSalt: 'test-salt',
    contentFilesRoot: '/content/files',
    contentRoot: '/content',
    defaultLocale: 'en',
    defaultProfileSlug: 'default',
    manifest: {
      content: {
        en: {
          default: {
            title: 'Public',
          },
        },
      },
      contentSchema: 'cv.content.v1',
      locales: ['en'],
      profiles: ['default'],
      schema: 'content-manifest.v1',
    },
    profiles: ['default'],
    privateRuntimeInput: null,
    privateRoutes: [],
  },
} satisfies ContentArtifacts

describe('content virtual module', () => {
  test('generates a lean route metadata virtual module', async () => {
    const source = await runEffectPromise(
      createContentVirtualModuleSource(artifacts)
    )

    expect(source).toContain('export const privateContentRoutes')
    expect(source).toContain('export const getLocales')
    expect(source).toContain('export const getPrivateRoutes')
    expect(source).not.toContain('export const getContent')
    expect(source).not.toContain('export const loadPrivateRuntimeProfile')
    expect(source).not.toContain('privateContentFileIndex')
    expect(source).not.toContain('encrypted-hiring')
    expect(source).not.toContain('encrypted-sales')
  })

  test('generates a lean runtime virtual module for browser imports', async () => {
    const source = await runEffectPromise(
      createContentRuntimeVirtualModuleSource(artifacts)
    )

    expect(source).toContain('export const loadPrivateRuntimeProfile')
    expect(source).toContain(
      '"abc123____0": () => import("virtual:content/generated/private-runtime/en/abc123____0")'
    )
    expect(source).toContain(
      '"abc123____1": () => import("virtual:content/generated/private-runtime/en/abc123____1")'
    )
    expect(source).not.toContain('privateContentRuntimeManifest')
    expect(source).not.toContain('encrypted-hiring')
    expect(source).not.toContain('encrypted-sales')
  })

  test('generates one private runtime profile virtual module per selector', () => {
    const source = createContentPrivateRuntimeProfileVirtualModuleSource(
      artifacts,
      {
        locale: 'en',
        selector: 'abc123____0',
      }
    )

    expect(source).toContain('"id":"p_hiring"')
    expect(source).toContain('"ciphertext":"encrypted-hiring"')
    expect(source).not.toContain('"id":"p_sales"')
    expect(source).not.toContain('"ciphertext":"encrypted-sales"')
  })
})
