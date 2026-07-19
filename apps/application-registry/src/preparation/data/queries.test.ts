import { describe, expect, test } from 'bun:test'

import {
  contentHeadAtom,
  contentRevisionAtom,
  cvPageStateAtom,
  preparationBootstrapAtom,
  preparationContextAtom,
  preparationModelsAtom,
} from './queries'

describe('preparation query atom families', () => {
  test('reuses context and bootstrap atoms for equivalent value keys', () => {
    expect(
      preparationContextAtom({ applicationId: 'application-1', locale: 'en' })
    ).toBe(
      preparationContextAtom({ applicationId: 'application-1', locale: 'en' })
    )
    expect(
      preparationBootstrapAtom({
        applicationId: 'application-1',
        kind: 'cv',
        locale: 'en',
      })
    ).toBe(
      preparationBootstrapAtom({
        applicationId: 'application-1',
        kind: 'cv',
        locale: 'en',
      })
    )
  })

  test('does not alias different preparation identities', () => {
    expect(
      preparationBootstrapAtom({
        applicationId: 'application-1',
        kind: 'cv',
        locale: 'en',
      })
    ).not.toBe(
      preparationBootstrapAtom({
        applicationId: 'application-1',
        kind: 'cover_letter',
        locale: 'en',
      })
    )
  })

  test('keys heads, revisions, and publication views by value', () => {
    expect(
      contentHeadAtom({
        applicationId: 'application-1',
        kind: 'cv',
        locale: 'en',
      })
    ).toBe(
      contentHeadAtom({
        applicationId: 'application-1',
        kind: 'cv',
        locale: 'en',
      })
    )
    expect(
      contentRevisionAtom({
        applicationId: 'application-1',
        entryId: 'entry-1',
        revisionId: 'revision-1',
      })
    ).toBe(
      contentRevisionAtom({
        applicationId: 'application-1',
        entryId: 'entry-1',
        revisionId: 'revision-1',
      })
    )
    expect(
      cvPageStateAtom({
        applicationId: 'application-1',
        entryId: 'entry-1',
        rendererVersion: 'renderer-1',
      })
    ).not.toBe(
      cvPageStateAtom({
        applicationId: 'application-1',
        entryId: 'entry-1',
        rendererVersion: 'renderer-2',
      })
    )
  })

  test('keeps authenticated and dormant model discovery separate', () => {
    expect(preparationModelsAtom(true)).toBe(preparationModelsAtom(true))
    expect(preparationModelsAtom(true)).not.toBe(preparationModelsAtom(false))
  })
})
