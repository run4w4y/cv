import { describe, expect, test } from 'bun:test'

import {
  initialTransientAiSessionState,
  reduceTransientAiSession,
} from './session'

describe('transient AI session', () => {
  test('clears model and operation metadata when a flow completes', () => {
    const selected = reduceTransientAiSession(initialTransientAiSessionState, {
      type: 'select-model',
      modelId: 'subscription-model',
    })
    const generated = reduceTransientAiSession(selected, {
      type: 'generated',
      operation: 'cv',
    })

    expect(reduceTransientAiSession(generated, { type: 'complete' })).toEqual(
      initialTransientAiSessionState
    )
  })
})
