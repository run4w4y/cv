import { describe, expect, test } from 'bun:test'

import { preparationEditorLocalStateAtom } from './atoms'
import type { PreparationEditorIdentity } from './model'

const identity: PreparationEditorIdentity = {
  applicationId: 'application-1',
  kind: 'cover_letter',
  locale: 'en',
}

describe('keyed preparation editor atoms', () => {
  test('canonicalizes structurally equivalent object identities', () => {
    expect(preparationEditorLocalStateAtom(identity)).toBe(
      preparationEditorLocalStateAtom({ ...identity })
    )
  })
})
