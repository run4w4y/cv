import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import {
  contentBuildConfigSchema,
  privateContentBuildSecretsSchema,
} from './config'

describe('content build schemas', () => {
  test('decodes build config as caller-supplied data', () => {
    const config = Schema.decodeUnknownSync(contentBuildConfigSchema)({
      contentIdSalt: 'salt',
      contentRoot: '/content',
    })

    expect(config).toEqual({
      contentIdSalt: 'salt',
      contentRoot: '/content',
    })
  })

  test('decodes private secrets without env-specific key names', () => {
    const secrets = Schema.decodeUnknownSync(privateContentBuildSecretsSchema)({
      rootKey: 'base64url:root-key',
    })

    expect(secrets.rootKey).toBe('base64url:root-key')
  })

  test('rejects private secrets without a root key', () => {
    expect(() =>
      Schema.decodeUnknownSync(privateContentBuildSecretsSchema)({})
    ).toThrow()
  })
})
