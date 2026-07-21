import { describe, expect, test } from 'bun:test'
import { cvGenerationGuidanceTestFixture } from '@cv/application-preparation-workflow/test-support'
import * as AtomRegistry from 'effect/unstable/reactivity/AtomRegistry'

import {
  cvGenerationGuidanceOverrideAtom,
  isValidCvGenerationGuidance,
} from './atoms'

describe('CV generation guidance overrides', () => {
  test('isolates overrides by facts release', () => {
    const registry = AtomRegistry.make()
    const first = cvGenerationGuidanceOverrideAtom('release-1')
    const repeated = cvGenerationGuidanceOverrideAtom('release-1')
    const second = cvGenerationGuidanceOverrideAtom('release-2')

    expect(first).toBe(repeated)
    registry.set(first, cvGenerationGuidanceTestFixture)
    expect(registry.get(repeated)).toEqual(cvGenerationGuidanceTestFixture)
    expect(registry.get(second)).toBeNull()
  })

  test('validates editable guidance before workflow startup', () => {
    expect(isValidCvGenerationGuidance(cvGenerationGuidanceTestFixture)).toBe(
      true
    )
    expect(
      isValidCvGenerationGuidance({
        ...cvGenerationGuidanceTestFixture,
        instruction: '',
      })
    ).toBe(false)
  })
})
