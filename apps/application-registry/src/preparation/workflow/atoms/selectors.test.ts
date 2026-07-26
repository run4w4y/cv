import { describe, expect, test } from 'bun:test'

import {
  applicationPreparationIdentity,
  latestApplicationArtifactAtom,
} from './selectors'

describe('preparation job selection', () => {
  test('reuses the atom for structurally equivalent application identities', () => {
    const identity = applicationPreparationIdentity('application-1', 'cv', 'en')

    expect(latestApplicationArtifactAtom(identity)).toBe(
      latestApplicationArtifactAtom({ ...identity })
    )
  })
})
