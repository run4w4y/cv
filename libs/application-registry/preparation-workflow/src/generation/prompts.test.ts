import { describe, expect, test } from 'bun:test'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import type { JsonSchema } from 'effect/JsonSchema'
import { cvGenerationGuidanceTestFixture } from '../test-support'
import {
  buildCoverLetterGenerationRequest,
  buildCvDraftGenerationRequest,
  factsForGeneration,
} from './prompts'

const arbitrarySchema = {
  type: 'object',
  additionalProperties: false,
  properties: { completelyDynamic: { type: 'string' } },
  required: ['completelyDynamic'],
} satisfies JsonSchema

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
      languages: [],
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
          companyVisibility: 'public',
          highlights: [],
          id: 'experience.public',
          period: '2025-present',
          roles: ['Engineer'],
          technologies: [],
          workstreams: [],
        },
        {
          company: 'Private Employer',
          companyVisibility: 'private',
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
  test('excludes private contacts, employers, projects, and links from every model stage', () => {
    const projected = JSON.stringify(factsForGeneration(visibilityFacts))

    expect(projected).toContain('public@example.test')
    expect(projected).toContain('Public Employer')
    expect(projected).toContain('Public Project')
    expect(projected).toContain('https://public.example.test')
    expect(projected).not.toContain('private-phone-value')
    expect(projected).not.toContain('Private Employer')
    expect(projected).not.toContain('Private employer fact.')
    expect(projected).not.toContain('Private Project')
    expect(projected).not.toContain('Private project fact.')
    expect(projected).not.toContain('https://private-link.example.test')
  })

  test('passes arbitrary schema, complete context, and content-owned guidance to CV generation', () => {
    const job = { requirements: ['something unusual'] }
    const guidance = cvGenerationGuidanceTestFixture
    const request = buildCvDraftGenerationRequest({
      factsCatalogue: facts,
      guidance,
      jobContext: job,
      locale: 'en',
      schema: arbitrarySchema,
    })

    expect(request.outputSchema).toBe(arbitrarySchema)
    expect(request.prompt).toContain('Verified fact.')
    expect(request.prompt).toContain('Preserve every metric.')
    expect(request.prompt).not.toContain('Private audit locator')
    expect(request.prompt).toContain(JSON.stringify(job, null, 2))
    expect(request.prompt).toContain(JSON.stringify(guidance, null, 2))
  })

  test('keeps the user-authored cover-letter prompt separate and complete', () => {
    const request = buildCoverLetterGenerationRequest({
      factsCatalogue: facts,
      jobContext: 'posting text',
      locale: 'en',
      prompt: 'Prefer a direct opening.',
      schema: arbitrarySchema,
    })

    expect(request.prompt).toContain('Prefer a direct opening.')
    expect(request.prompt).toContain('Verified fact.')
    expect(request.prompt).not.toContain('Private audit locator')
    expect(request.outputSchema).toBe(arbitrarySchema)
  })
})
