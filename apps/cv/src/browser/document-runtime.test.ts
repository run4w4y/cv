import { describe, expect, test } from 'bun:test'
import { activeSectionFromPositions } from './document-runtime'

const positions = [
  { id: 'about', top: 500 },
  { id: 'experience', top: 900 },
  { id: 'projects', top: 1400 },
]

describe('CV document runtime', () => {
  test('selects the last section above the header offset', () => {
    expect(
      activeSectionFromPositions({
        atPageEnd: false,
        positions,
        scrollPosition: 1100,
      })
    ).toBe('experience')
  })

  test('selects the final section at the end of the page', () => {
    expect(
      activeSectionFromPositions({
        atPageEnd: true,
        positions,
        scrollPosition: 1100,
      })
    ).toBe('projects')
  })
})
