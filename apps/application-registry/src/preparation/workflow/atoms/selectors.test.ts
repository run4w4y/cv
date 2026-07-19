import { describe, expect, test } from 'bun:test'

import {
  applicationPreparationIdentity,
  latestApplicationRunAtom,
} from './selectors'

describe('preparation run selection', () => {
  test('reuses the atom for structurally equivalent application identities', () => {
    const identity = applicationPreparationIdentity('application-1', 'cv', 'en')

    expect(latestApplicationRunAtom(identity)).toBe(
      latestApplicationRunAtom({ ...identity })
    )
  })
})
