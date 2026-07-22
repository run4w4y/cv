import { describe, expect, test } from 'bun:test'

import {
  contentHeadIdentityKey,
  contentMutationReactivityKeys,
  preparationContextIdentityKey,
  preparationIdentityKey,
  preparationReactivity,
  publicationIdentityKey,
} from './keys'

describe('preparation atom identity keys', () => {
  test('uses values rather than object identity', () => {
    expect(
      preparationIdentityKey({
        applicationId: 'application/1',
        kind: 'cv',
        locale: 'en',
      })
    ).toBe(
      preparationIdentityKey({
        applicationId: 'application/1',
        kind: 'cv',
        locale: 'en',
      })
    )
  })

  test('separates document kind and locale', () => {
    const cv = preparationIdentityKey({
      applicationId: 'application-1',
      kind: 'cv',
      locale: 'en',
    })
    const letter = preparationIdentityKey({
      applicationId: 'application-1',
      kind: 'cover_letter',
      locale: 'en',
    })
    const russian = preparationIdentityKey({
      applicationId: 'application-1',
      kind: 'cv',
      locale: 'ru',
    })

    expect(new Set([cv, letter, russian]).size).toBe(3)
  })

  test('distinguishes missing and explicit revision or renderer values', () => {
    expect(
      contentHeadIdentityKey({
        applicationId: 'application-1',
        entryId: 'entry-1',
        revisionId: null,
      })
    ).not.toBe(
      contentHeadIdentityKey({
        applicationId: 'application-1',
        entryId: 'entry-1',
        revisionId: '',
      })
    )
    expect(
      publicationIdentityKey({
        applicationId: 'application-1',
        entryId: 'entry-1',
      })
    ).not.toBe(
      publicationIdentityKey({
        applicationId: 'application-1',
        entryId: 'entry-1',
        rendererVersion: '',
      })
    )
  })

  test('shares snapshot identity across facts locales', () => {
    expect(
      preparationContextIdentityKey({
        applicationId: 'application-1',
        locale: 'en',
      })
    ).not.toBe(
      preparationContextIdentityKey({
        applicationId: 'application-1',
        locale: 'ru',
      })
    )
    expect(preparationReactivity.snapshot('application-1')).toBe(
      preparationReactivity.snapshot('application-1')
    )
  })

  test('content writes invalidate the keyed entry and immutable head view', () => {
    const identity = {
      applicationId: 'application-1',
      kind: 'cv',
      locale: 'en',
    } as const
    expect(contentMutationReactivityKeys(identity, 'entry-1')).toContain(
      preparationReactivity.entry(identity)
    )
    expect(contentMutationReactivityKeys(identity, 'entry-1')).toContain(
      preparationReactivity.content('application-1', 'entry-1')
    )
  })
})
