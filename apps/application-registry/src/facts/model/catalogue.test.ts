import { describe, expect, test } from 'bun:test'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'

import {
  factsCatalogueCounts,
  filterFactsSections,
  reviewedFactCount,
  shortCommit,
  shortReleaseId,
} from './catalogue'

const fact = (id: string, text: string) => ({ id, text })

const catalogue = {
  $schema: 'cv.facts.v1',
  locale: 'en',
  evidence: [],
  assets: [],
  sections: [
    {
      kind: 'identity',
      name: 'Marat',
      overview: fact('identity-overview', 'Platform engineer'),
      facts: [fact('identity-fact', 'Works across product boundaries')],
      languages: [],
    },
    {
      kind: 'experience',
      entries: [
        {
          id: 'experience-example',
          company: 'Example Company',
          companyVisibility: 'public',
          period: '2024–present',
          roles: ['Staff Engineer'],
          highlights: [fact('experience-highlight', 'Built a registry')],
          workstreams: [
            {
              id: 'registry-workstream',
              title: 'Application registry',
              contributions: [
                fact(
                  'workstream-contribution',
                  'Designed verified facts reads'
                ),
              ],
              technologies: ['Effect', 'React'],
            },
          ],
          technologies: ['TypeScript'],
        },
      ],
    },
  ],
} satisfies FactsCatalogueV1

describe('facts catalogue presentation model', () => {
  test('counts reviewed facts throughout nested sections', () => {
    expect(reviewedFactCount(catalogue.sections[0])).toBe(2)
    expect(reviewedFactCount(catalogue.sections[1])).toBe(2)
    expect(factsCatalogueCounts(catalogue)).toEqual({
      assets: 0,
      evidence: 0,
      facts: 4,
      sections: 2,
    })
  })

  test('searches nested text while preserving matching section hierarchy', () => {
    expect(filterFactsSections(catalogue.sections, 'verified')).toEqual([
      catalogue.sections[1],
    ])
    expect(filterFactsSections(catalogue.sections, 'marat')).toEqual([
      catalogue.sections[0],
    ])
    expect(filterFactsSections(catalogue.sections, 'missing')).toEqual([])
    expect(filterFactsSections(catalogue.sections, '  ')).toBe(
      catalogue.sections
    )
  })

  test('shortens immutable identifiers for compact summaries', () => {
    const digest = 'a'.repeat(64)
    expect(shortCommit(digest)).toBe('a'.repeat(12))
    expect(shortReleaseId(`fr_${digest}`)).toBe(
      `${'fr_aaaaaaaa'.slice(0, 11)}…${'a'.repeat(8)}`
    )
  })
})
