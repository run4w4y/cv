import { beforeEach, describe, expect, test } from 'bun:test'
import { waitFor } from '@testing-library/react'
import * as AtomRegistry from 'effect/unstable/reactivity/AtomRegistry'

import {
  coverLetterPromptAtom,
  coverLetterPromptStorageKey,
  initialCoverLetterPrompt,
} from '@/preparation/forms/atoms'
import {
  batchPreparationFormAtom,
  batchPreparationPostingUrlRowsAtom,
  batchPreparationValidationAtom,
  initialBatchPreparationForm,
  parsedBatchPostingTargetsAtom,
} from './atoms'

beforeEach(() => {
  window.localStorage.removeItem(coverLetterPromptStorageKey)
})

describe('batch preparation form', () => {
  test('persists only the cover-letter prompt between registries', async () => {
    const first = AtomRegistry.make()
    const unmountFirst = first.mount(batchPreparationFormAtom)
    first.update(batchPreparationFormAtom, (form) => ({
      ...form,
      locale: 'en',
      postingUrls: 'https://jobs.example.test/first',
      prompt: 'Keep the letter direct and under 250 words.',
    }))

    await waitFor(() => {
      expect(window.localStorage.getItem(coverLetterPromptStorageKey)).toBe(
        JSON.stringify('Keep the letter direct and under 250 words.')
      )
    })
    unmountFirst()
    first.dispose()

    const second = AtomRegistry.make()
    const unmountSecond = second.mount(batchPreparationFormAtom)
    await waitFor(() => {
      expect(second.get(batchPreparationFormAtom)).toEqual({
        ...initialBatchPreparationForm,
        prompt: 'Keep the letter direct and under 250 words.',
      })
    })
    unmountSecond()
    second.dispose()
  })

  test('falls back to the canonical prompt when stored data is malformed', async () => {
    window.localStorage.setItem(coverLetterPromptStorageKey, '{invalid json')
    const registry = AtomRegistry.make()
    const unmount = registry.mount(coverLetterPromptAtom)

    await waitFor(() => {
      expect(registry.get(coverLetterPromptAtom)).toBe(initialCoverLetterPrompt)
    })

    unmount()
    registry.dispose()
  })

  test('validates each URL, canonicalizes it, and reports duplicates by line', () => {
    const registry = AtomRegistry.make()
    registry.set(batchPreparationFormAtom, {
      ...initialBatchPreparationForm,
      locale: 'en',
      postingUrls: [
        'https://jobs.example.test/role#details',
        'https://jobs.example.test/role',
        'ftp://jobs.example.test/other',
      ].join('\n'),
    })

    expect(registry.get(parsedBatchPostingTargetsAtom)).toEqual([
      {
        _tag: 'PostingUrl',
        url: 'https://jobs.example.test/role',
      },
    ])
    expect(registry.get(batchPreparationPostingUrlRowsAtom)).toMatchObject([
      { canonicalUrl: 'https://jobs.example.test/role', duplicateOf: null },
      { canonicalUrl: 'https://jobs.example.test/role', duplicateOf: 1 },
      { canonicalUrl: null, line: 3 },
    ])
    expect(registry.get(batchPreparationValidationAtom).targetsValid).toBe(
      false
    )
  })

  test('requires an explicit published locale selection before launch', () => {
    const registry = AtomRegistry.make()
    registry.set(batchPreparationFormAtom, {
      ...initialBatchPreparationForm,
      postingUrls: 'https://jobs.example.test/role',
    })

    const validation = registry.get(batchPreparationValidationAtom)
    expect(validation.targetsValid).toBe(true)
    expect(validation.settingsValid).toBe(false)
    expect(validation.canStart).toBe(false)
  })

  test('enforces cover-letter instructions and their schema length boundary', () => {
    const registry = AtomRegistry.make()
    registry.set(batchPreparationFormAtom, {
      includeCoverLetter: true,
      locale: 'en',
      postingUrls: 'https://jobs.example.test/role',
      prompt: '',
    })
    expect(registry.get(batchPreparationValidationAtom)).toMatchObject({
      canStart: false,
      promptMissing: true,
      promptTooLong: false,
    })

    registry.set(batchPreparationFormAtom, {
      includeCoverLetter: true,
      locale: 'en',
      postingUrls: 'https://jobs.example.test/role',
      prompt: 'x'.repeat(20_001),
    })
    expect(registry.get(batchPreparationValidationAtom)).toMatchObject({
      canStart: false,
      promptMissing: false,
      promptTooLong: true,
    })
  })
})
