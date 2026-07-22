import { describe, expect, test } from 'bun:test'
import * as AtomRegistry from 'effect/unstable/reactivity/AtomRegistry'

import {
  batchPreparationFormAtom,
  batchPreparationUrlRowsAtom,
  batchPreparationValidationAtom,
  initialBatchPreparationForm,
  parsedBatchUrlsAtom,
} from './atoms'

describe('batch preparation form', () => {
  test('validates each URL, canonicalizes it, and reports duplicates by line', () => {
    const registry = AtomRegistry.make()
    registry.set(batchPreparationFormAtom, {
      ...initialBatchPreparationForm,
      locale: 'en',
      urls: [
        'https://jobs.example.test/role#details',
        'https://jobs.example.test/role',
        'ftp://jobs.example.test/other',
      ].join('\n'),
    })

    expect(registry.get(parsedBatchUrlsAtom)).toEqual([
      'https://jobs.example.test/role',
    ])
    expect(registry.get(batchPreparationUrlRowsAtom)).toMatchObject([
      { canonicalUrl: 'https://jobs.example.test/role', duplicateOf: null },
      { canonicalUrl: 'https://jobs.example.test/role', duplicateOf: 1 },
      { canonicalUrl: null, line: 3 },
    ])
    expect(registry.get(batchPreparationValidationAtom).urlsValid).toBe(false)
  })

  test('requires an explicit published locale selection before launch', () => {
    const registry = AtomRegistry.make()
    registry.set(batchPreparationFormAtom, {
      ...initialBatchPreparationForm,
      urls: 'https://jobs.example.test/role',
    })

    const validation = registry.get(batchPreparationValidationAtom)
    expect(validation.urlsValid).toBe(true)
    expect(validation.settingsValid).toBe(false)
    expect(validation.canStart).toBe(false)
  })

  test('enforces cover-letter instructions and their schema length boundary', () => {
    const registry = AtomRegistry.make()
    registry.set(batchPreparationFormAtom, {
      kind: 'cover_letter',
      locale: 'en',
      prompt: '',
      urls: 'https://jobs.example.test/role',
    })
    expect(registry.get(batchPreparationValidationAtom)).toMatchObject({
      canStart: false,
      promptMissing: true,
      promptTooLong: false,
    })

    registry.set(batchPreparationFormAtom, {
      kind: 'cover_letter',
      locale: 'en',
      prompt: 'x'.repeat(20_001),
      urls: 'https://jobs.example.test/role',
    })
    expect(registry.get(batchPreparationValidationAtom)).toMatchObject({
      canStart: false,
      promptMissing: false,
      promptTooLong: true,
    })
  })
})
