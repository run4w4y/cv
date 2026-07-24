import { describe, expect, test } from 'bun:test'

import { CodexSdkError } from './codex/sdk'
import { describeCause } from './diagnostics'

describe('desktop diagnostics', () => {
  test('preserves tagged error codes and provider details', () => {
    const cause = new CodexSdkError(
      'invalid_request',
      'Codex rejected the structured-output schema.',
      'Invalid schema for response_format: allOf is not permitted.'
    )

    expect(describeCause(cause)).toMatchObject({
      code: 'invalid_request',
      details: 'Invalid schema for response_format: allOf is not permitted.',
      message: 'Codex rejected the structured-output schema.',
      tag: 'CodexSdkError',
    })
  })
})
