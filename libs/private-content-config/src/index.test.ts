import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import {
  missingPrivateContentAccessEnv,
  privateContentEnvNames,
  readPrivateAudienceKeyFromEnv,
  readPrivateContentBuildConfigFromEnv,
  readPrivateContentBuildSecretsFromEnv,
  readPrivateContentIdSaltFromEnv,
  readRequiredPrivateContentBuildSecrets,
  withPrivateContentEnv,
} from './index'

describe('private content config', () => {
  test('reads content build config from normalized env', () => {
    expect(
      readPrivateContentBuildConfigFromEnv({
        CONTENT_ID_SALT: ' salt ',
        CONTENT_ROOT: ' /content ',
      })
    ).toEqual({
      contentIdSalt: 'salt',
      contentRoot: '/content',
    })
  })

  test('reads optional private build secrets from env', () => {
    const secrets = readPrivateContentBuildSecretsFromEnv({
      PRIVATE_CONTENT_ROOT_KEY: 'base64url:root-key',
    })

    expect(secrets).toEqual({
      rootKey: 'base64url:root-key',
    })
  })

  test('returns null when private build secrets are absent', () => {
    expect(readPrivateContentBuildSecretsFromEnv({})).toBeNull()
  })

  test('requires private build secrets when requested', async () => {
    const result = await Effect.runPromiseExit(
      withPrivateContentEnv(readRequiredPrivateContentBuildSecrets, {})
    )

    expect(result._tag).toBe('Failure')
    expect(result.toString()).toContain('PrivateContentConfigError')
  })

  test('reads private audience key and tracks missing access env', () => {
    expect(
      readPrivateContentIdSaltFromEnv({
        CONTENT_ID_SALT: ' salt ',
      })
    ).toBe('salt')
    expect(
      readPrivateAudienceKeyFromEnv({
        PRIVATE_CONTENT_AUDIENCE_KEY: ' audience-key ',
      })
    ).toBe('audience-key')
    expect(
      missingPrivateContentAccessEnv({
        CONTENT_ID_SALT: 'salt',
        CONTENT_ROOT: '  ',
      })
    ).toEqual([
      privateContentEnvNames.audienceKey,
      privateContentEnvNames.rootKey,
    ])
  })
})
