import { describe, expect, test } from 'bun:test'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { cvGenerationGuidanceTestFixture } from '../test-support'
import {
  buildCoverLetterGenerationRequest,
  buildCvDraftGenerationRequest,
  evidenceReferencesForGeneration,
  factsForGeneration,
} from './prompts'

const facts = {
  $schema: 'cv.facts.v1',
  assets: [],
  sections: [
    {
      kind: 'identity',
      name: 'Ada Lovelace',
      guidance: {
        wording: 'summarize',
        instructions: ['Preserve every metric.'],
      },
      facts: [
        {
          evidenceIds: ['evidence.private-review'],
          id: 'fact-x',
          text: 'Verified fact.',
        },
      ],
      languages: [
        {
          id: 'identity.languages.0',
          name: 'English',
          proficiency: 'Fluent',
        },
      ],
    },
    {
      groups: [
        {
          id: 'skills.groups.0',
          skills: [
            {
              id: 'skills.groups.0.skills.2',
              name: 'Effect',
            },
          ],
          title: 'Engineering',
        },
      ],
      kind: 'skills',
    },
  ],
  evidence: [
    {
      id: 'evidence.private-review',
      kind: 'private-source',
      note: 'Private audit locator',
      title: 'Private review',
    },
  ],
  locale: 'en',
} satisfies FactsCatalogueV1

const visibilityFacts = {
  $schema: 'cv.facts.v1',
  assets: [],
  evidence: [],
  locale: 'en',
  sections: [
    {
      items: [
        {
          id: 'contact.public',
          kind: 'email',
          value: 'public@example.test',
          visibility: 'public',
        },
        {
          id: 'contact.private',
          kind: 'phone',
          value: 'private-phone-value',
          visibility: 'private',
        },
      ],
      kind: 'contact',
    },
    {
      entries: [
        {
          company: 'Public Employer',
          highlights: [],
          id: 'experience.public',
          period: '2025-present',
          roles: ['Engineer'],
          technologies: [],
          workstreams: [],
        },
        {
          company: 'Private Employer',
          highlights: [
            { id: 'fact.private-employer', text: 'Private employer fact.' },
          ],
          id: 'experience.private',
          period: '2024-2025',
          roles: ['Engineer'],
          technologies: [],
          workstreams: [],
        },
      ],
      kind: 'experience',
    },
    {
      entries: [
        {
          contributions: [],
          id: 'project.public',
          links: [
            {
              id: 'link.public',
              label: 'Public link',
              url: 'https://public.example.test',
              visibility: 'public',
            },
            {
              id: 'link.private',
              label: 'Private link',
              url: 'https://private-link.example.test',
              visibility: 'private',
            },
          ],
          name: 'Public Project',
          summary: { id: 'fact.public-project', text: 'Public project fact.' },
          technologies: [],
          visibility: 'public',
        },
        {
          contributions: [],
          id: 'project.private',
          links: [],
          name: 'Private Project',
          summary: {
            id: 'fact.private-project',
            text: 'Private project fact.',
          },
          technologies: [],
          visibility: 'private',
        },
      ],
      kind: 'projects',
    },
  ],
} satisfies FactsCatalogueV1

describe('preparation request construction', () => {
  test('keeps every employer while filtering independently private content', () => {
    const projected = JSON.stringify(factsForGeneration(visibilityFacts))

    expect(projected).toContain('public@example.test')
    expect(projected).toContain('Public Employer')
    expect(projected).toContain('Private Employer')
    expect(projected).toContain('Private employer fact.')
    expect(projected).toContain('Public Project')
    expect(projected).toContain('https://public.example.test')
    expect(projected).not.toContain('private-phone-value')
    expect(projected).not.toContain('Private Project')
    expect(projected).not.toContain('Private project fact.')
    expect(projected).not.toContain('https://private-link.example.test')
  })

  test('passes role context and content-owned guidance without the complete facts catalogue', () => {
    const job = {
      keywords: ['Effect'],
      location: null,
      responsibilities: ['Build reliable systems.'],
      role: 'Platform Engineer',
    }
    const guidance = cvGenerationGuidanceTestFixture
    const request = buildCvDraftGenerationRequest({
      guidance,
      job,
      locale: 'en',
    })

    expect(request.prompt).not.toContain('Verified fact.')
    expect(request.prompt).toContain(JSON.stringify(job, null, 2))
    expect(request.prompt).toContain(JSON.stringify(guidance, null, 2))
  })

  test('projects compiler-generated language and skill IDs as selectable evidence', () => {
    const references = evidenceReferencesForGeneration(facts)

    expect(references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'fact-x',
          kind: 'reviewed-fact',
          label: 'Verified fact.',
        }),
        expect.objectContaining({
          id: 'identity.languages.0',
          kind: 'language',
          label: 'English',
        }),
        expect.objectContaining({
          id: 'skills.groups.0.skills.2',
          kind: 'skill',
          label: 'Effect',
        }),
      ])
    )
  })

  test('keeps all experience selectable while excluding private projects', () => {
    const ids = evidenceReferencesForGeneration(visibilityFacts).map(
      ({ id }) => id
    )

    expect(ids).toContain('experience.public')
    expect(ids).toContain('experience.private')
    expect(ids).toContain('fact.private-employer')
    expect(ids).toContain('project.public')
    expect(ids).not.toContain('project.private')
    expect(ids).not.toContain('fact.private-project')
    expect(ids).not.toContain('contact.public')
    expect(ids).not.toContain('contact.private')
    expect(ids).not.toContain('link.public')
    expect(ids).not.toContain('link.private')
  })

  test('keeps the user-authored cover-letter prompt separate and complete', () => {
    const request = buildCoverLetterGenerationRequest({
      approvedCv: {
        $schema: 'cv.document.v1',
        additionalSections: [],
        direction: 'ltr',
        education: [],
        experience: [],
        locale: 'en',
        person: {
          contacts: [],
          headline: 'Platform Engineer',
          name: 'Ada Example',
          summary: 'Builds reliable systems.',
        },
        projects: [],
        skills: [],
      },
      evidence: evidenceReferencesForGeneration(facts),
      job: {
        company: 'Example',
        keywords: ['Effect'],
        location: null,
        responsibilities: ['Build reliable systems.'],
        role: 'Platform Engineer',
      },
      locale: 'en',
      prompt: 'Prefer a direct opening.',
    })

    expect(request.prompt).toContain('Prefer a direct opening.')
    expect(request.prompt).toContain('Verified fact.')
    expect(request.prompt).not.toContain('Private audit locator')
  })
})
