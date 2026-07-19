import { describe, expect, test } from 'bun:test'

import { preparationWorkspaceAtom } from './atoms'

describe('preparation workspace atoms', () => {
  test('reuse a workspace atom for structurally equivalent identities', () => {
    const identity = {
      applicationId: 'application-1',
      kind: 'cv' as const,
      locale: 'en',
      requestedRunId: 'run-1',
    }

    expect(preparationWorkspaceAtom(identity)).toBe(
      preparationWorkspaceAtom({ ...identity })
    )
  })

  test('do not alias a different requested run', () => {
    const identity = {
      applicationId: 'application-1',
      kind: 'cv' as const,
      locale: 'en',
      requestedRunId: 'run-1',
    }

    expect(preparationWorkspaceAtom(identity)).not.toBe(
      preparationWorkspaceAtom({ ...identity, requestedRunId: 'run-2' })
    )
  })
})
