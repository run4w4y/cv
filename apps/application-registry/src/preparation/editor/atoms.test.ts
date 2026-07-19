import { describe, expect, test } from 'bun:test'
import * as AtomRegistry from 'effect/unstable/reactivity/AtomRegistry'

import { selectedPreparationModelAtom } from '../forms/atoms'
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

  test('keeps selected model state isolated by Atom registry', () => {
    const first = AtomRegistry.make()
    const second = AtomRegistry.make()

    first.set(selectedPreparationModelAtom, 'model-1')

    expect(first.get(selectedPreparationModelAtom)).toBe('model-1')
    expect(second.get(selectedPreparationModelAtom)).toBeNull()
  })
})
