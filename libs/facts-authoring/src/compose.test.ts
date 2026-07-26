import { describe, expect, test } from 'bun:test'
import { cvGenerationGuidanceFieldTargetValues } from '@cv/contracts/document'
import { Effect, Exit } from 'effect'

import { composeFactsRepository } from './compose'

const section = (locale: 'en' | 'ru') => ({
  kind: 'identity',
  name: locale === 'en' ? 'Ada Lovelace' : 'Ада Лавлейс',
  facts: [
    {
      evidenceIds: ['evidence.current-role-review'],
      text:
        locale === 'en'
          ? 'Works as a software engineer.'
          : 'Работает инженером-программистом.',
    },
  ],
  languages: [
    {
      name: locale === 'en' ? 'English' : 'Английский',
      proficiency: locale === 'en' ? 'Fluent' : 'Свободно',
    },
  ],
})

const input = {
  assetDigests: {},
  assets: {},
  config: {
    defaultLocale: 'en',
    factsDir: 'facts',
    generationGuidance: 'generation/cv.ts',
    locales: ['en', 'ru'],
  },
  evidence: {
    'evidence.current-role-review': {
      kind: 'personal-review',
      title: 'Current role review',
    },
  },
  generationGuidance: {
    $schema: 'cv.generation-guidance.v1',
    documentContract: 'cv.document.v1',
    fields: cvGenerationGuidanceFieldTargetValues.map((target) => ({
      instruction: `Write ${target} from reviewed facts.`,
      sources: ['trusted-facts'],
      target,
    })),
    instruction: 'Produce a truthful CV from reviewed facts.',
    label: 'Reviewed CV guidance',
    rules: ['Do not invent claims.'],
    sources: ['trusted-facts', 'job-context'],
  },
  sections: [
    {
      locale: 'en',
      relativePath: 'facts/en/identity.ts',
      value: section('en'),
    },
    {
      locale: 'ru',
      relativePath: 'facts/ru/identity.ts',
      value: section('ru'),
    },
  ],
}

describe('facts repository composition', () => {
  test('uses the authored locale config as the source of truth', async () => {
    const compilation = await Effect.runPromise(composeFactsRepository(input))

    expect(compilation.config.locales).toEqual(['en', 'ru'])
    expect(compilation.catalogues.map(({ locale }) => locale)).toEqual([
      'en',
      'ru',
    ])
    expect(compilation.catalogues[0]?.sections[0]?.kind).toBe('identity')
    expect(compilation.catalogues[1]?.sections[0]?.kind).toBe('identity')
    const englishIdentity = compilation.catalogues[0]?.sections[0]
    if (englishIdentity?.kind !== 'identity') {
      throw new Error('Expected the first English section to be identity.')
    }
    expect(englishIdentity.facts[0]?.id).toBe('identity.facts.0')
    expect(englishIdentity.languages[0]?.id).toBe('identity.languages.0')
  })

  test('generates stable IDs for selectable skill entries', async () => {
    const skills = (locale: 'en' | 'ru') => ({
      groups: [
        {
          skills: [
            {
              name: locale === 'en' ? 'Effect' : 'Effect',
            },
          ],
          title: locale === 'en' ? 'Engineering' : 'Разработка',
        },
      ],
      kind: 'skills',
    })
    const compilation = await Effect.runPromise(
      composeFactsRepository({
        ...input,
        sections: [
          ...input.sections,
          {
            locale: 'en',
            relativePath: 'facts/en/skills.ts',
            value: skills('en'),
          },
          {
            locale: 'ru',
            relativePath: 'facts/ru/skills.ts',
            value: skills('ru'),
          },
        ],
      })
    )
    const englishSkills = compilation.catalogues[0]?.sections.find(
      ({ kind }) => kind === 'skills'
    )
    if (englishSkills?.kind !== 'skills') {
      throw new Error('Expected an English skills section.')
    }

    expect(englishSkills.groups[0]?.id).toBe('skills.groups.0')
    expect(englishSkills.groups[0]?.skills[0]?.id).toBe(
      'skills.groups.0.skills.0'
    )
  })

  test('rejects a configured locale without authored sections', async () => {
    const exit = await Effect.runPromiseExit(
      composeFactsRepository({
        ...input,
        sections: input.sections.filter(({ locale }) => locale === 'en'),
      })
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain(
        'Configured locale ru has no authored fact sections.'
      )
    }
  })

  test('rejects structural drift between locale trees', async () => {
    const exit = await Effect.runPromiseExit(
      composeFactsRepository({
        ...input,
        sections: input.sections.map((source) =>
          source.locale === 'ru'
            ? {
                ...source,
                value: {
                  ...section('ru'),
                  facts: [],
                },
              }
            : source
        ),
      })
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain(
        'Section structure or locale-invariant data does not match en.'
      )
    }
  })

  test('rejects hand-authored internal IDs', async () => {
    const exit = await Effect.runPromiseExit(
      composeFactsRepository({
        ...input,
        sections: input.sections.map((source) =>
          source.locale === 'en'
            ? {
                ...source,
                value: {
                  ...section('en'),
                  facts: [
                    {
                      id: 'identity.manual-id',
                      text: 'Works as a software engineer.',
                    },
                  ],
                },
              }
            : source
        ),
      })
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain(
        'Invalid authored facts value at facts/en/identity.ts.'
      )
    }
  })

  test('rejects locale-specific technology drift', async () => {
    const experience = (locale: 'en' | 'ru') => ({
      kind: 'experience',
      entries: [
        {
          company: locale === 'en' ? 'Company' : 'Компания',
          period: '2024',
          roles: [],
          highlights: [],
          workstreams: [],
          technologies: locale === 'en' ? ['Effect'] : ['Эффект'],
        },
      ],
    })
    const exit = await Effect.runPromiseExit(
      composeFactsRepository({
        ...input,
        sections: [
          ...input.sections,
          {
            locale: 'en',
            relativePath: 'facts/en/experience/index.ts',
            value: experience('en'),
          },
          {
            locale: 'ru',
            relativePath: 'facts/ru/experience/index.ts',
            value: experience('ru'),
          },
        ],
      })
    )

    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      expect(String(exit.cause)).toContain(
        'Section structure or locale-invariant data does not match en.'
      )
    }
  })
})
