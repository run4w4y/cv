import { describe, expect, test } from 'bun:test'

import {
  cvFixturePreviewToken,
  cvFixtureToken,
  cvOverflowFixturePreviewToken,
  cvOverflowFixtureToken,
  isCvFixtureModeEnabled,
  loadCvFixturePreview,
  loadCvFixturePublication,
} from './fixture-publications'

describe('CV fixture publications', () => {
  test('enables fixture mode only for an explicit development environment', () => {
    expect(
      isCvFixtureModeEnabled({ CV_FIXTURE_MODE: '1', NODE_ENV: 'development' })
    ).toBe(true)
    expect(
      isCvFixtureModeEnabled({ CV_FIXTURE_MODE: '1', NODE_ENV: 'production' })
    ).toBe(false)
    expect(
      isCvFixtureModeEnabled({
        CV_FIXTURE_MODE: undefined,
        NODE_ENV: 'development',
      })
    ).toBe(false)
  })

  test('serves the canonical public and capability preview fixtures', () => {
    const publication = loadCvFixturePublication(cvFixtureToken)
    const preview = loadCvFixturePreview(cvFixtureToken, cvFixturePreviewToken)

    expect(publication.tag).toBe('success')
    expect(preview.tag).toBe('success')
    expect(
      publication.tag === 'success' ? publication.document.person.name : null
    ).toBe('Ada Lovelace')
  })

  test('serves a valid deliberately overflowing PDF fixture', () => {
    const publication = loadCvFixturePreview(
      cvOverflowFixtureToken,
      cvOverflowFixturePreviewToken
    )

    expect(publication.tag).toBe('success')
    expect(
      publication.tag === 'success' ? publication.document.experience.length : 0
    ).toBe(6)
  })

  test('keeps unknown fixture capabilities unavailable', () => {
    expect(loadCvFixturePublication('missing')).toEqual({ tag: 'not-found' })
    expect(loadCvFixturePreview(cvFixtureToken, 'wrong-access')).toEqual({
      tag: 'not-found',
    })
  })
})
