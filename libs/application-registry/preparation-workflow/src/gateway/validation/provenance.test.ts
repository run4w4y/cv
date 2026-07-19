import { describe, expect, test } from 'bun:test'
import type { CvDocumentV1 } from '@cv/contracts/document'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Effect } from 'effect'

import type { PreparationWorkflowError } from '../../domain'
import { validateCvProvenance } from './provenance'

const factsCatalogue: FactsCatalogueV1 = {
  $schema: 'cv.facts.v1',
  assets: [],
  evidence: [],
  locale: 'en',
  sections: [
    {
      facts: [{ id: 'fact.certification', text: 'Cloud certified.' }],
      kind: 'identity',
      languages: [],
      location: 'London, UK',
      name: 'Ada Example',
    },
    {
      items: [
        {
          id: 'contact.email',
          kind: 'email',
          url: 'mailto:ada@example.test',
          value: 'ada@example.test',
          visibility: 'public',
        },
      ],
      kind: 'contact',
    },
    {
      entries: [
        {
          company: 'Analytical Engines',
          companyVisibility: 'public',
          highlights: [],
          id: 'experience.engine',
          location: 'Remote',
          period: '2023-present',
          roles: ['Platform engineer'],
          technologies: ['Effect'],
          workstreams: [],
        },
        {
          company: 'Confidential Client',
          companyVisibility: 'private',
          highlights: [],
          id: 'experience.private',
          period: '2022-2023',
          roles: ['Consultant'],
          technologies: [],
          workstreams: [],
        },
      ],
      kind: 'experience',
    },
  ],
}

const validAdditionalItem: CvDocumentV1['additionalSections'][number]['items'][number] =
  {
    id: 'fact.certification',
    text: 'Cloud certified.',
    title: 'Certification',
  }

const validAdditionalSection: CvDocumentV1['additionalSections'][number] = {
  id: 'additional.certifications',
  items: [validAdditionalItem],
  title: 'Certifications',
}

const validExperience: CvDocumentV1['experience'][number] = {
  company: 'Analytical Engines',
  highlights: [],
  id: 'experience.engine',
  location: 'Remote',
  period: '2023-present',
  role: 'Platform engineer',
  technologies: ['Effect'],
}

const validCv: CvDocumentV1 = {
  $schema: 'cv.document.v1',
  additionalSections: [validAdditionalSection],
  direction: 'ltr',
  education: [],
  experience: [validExperience],
  locale: 'en',
  person: {
    contacts: [
      {
        href: 'mailto:ada@example.test',
        kind: 'email',
        label: 'Email',
        value: 'ada@example.test',
      },
    ],
    headline: 'Platform engineer',
    location: 'London, UK',
    name: 'Ada Example',
    summary: 'Builds reliable systems.',
  },
  projects: [],
  skills: [],
}

const failureOf = <A>(effect: Effect.Effect<A, PreparationWorkflowError>) =>
  Effect.runPromise(Effect.flip(effect))

describe('CV provenance validation', () => {
  test('checks copied metadata and additional reviewed-fact IDs', async () => {
    await Effect.runPromise(validateCvProvenance(factsCatalogue, validCv))

    const metadataError = await failureOf(
      validateCvProvenance(factsCatalogue, {
        ...validCv,
        experience: [{ ...validExperience, company: 'Invented Employer' }],
      })
    )
    expect(metadataError.message).toContain(
      'experience:experience.engine.company was changed'
    )

    const additionalError = await failureOf(
      validateCvProvenance(factsCatalogue, {
        ...validCv,
        additionalSections: [
          {
            ...validAdditionalSection,
            items: [{ ...validAdditionalItem, id: 'fact.invented' }],
          },
        ],
      })
    )
    expect(additionalError.message).toContain(
      'fact.invented is not a reviewed fact ID'
    )

    const privateEntryError = await failureOf(
      validateCvProvenance(factsCatalogue, {
        ...validCv,
        experience: [
          {
            company: 'Confidential Client',
            highlights: [],
            id: 'experience.private',
            period: '2022-2023',
            role: 'Consultant',
            technologies: [],
          },
        ],
      })
    )
    expect(privateEntryError.message).toContain(
      'experience:experience.private is absent from the facts catalogue'
    )
  })
})
