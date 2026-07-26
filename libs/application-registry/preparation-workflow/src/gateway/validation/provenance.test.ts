import { describe, expect, test } from 'bun:test'
import type { CvDocumentV1 } from '@cv/contracts/document'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Effect } from 'effect'

import type { PreparationWorkflowError } from '../../domain'
import { cvProvenanceIssues, validateCvProvenance } from './provenance'

const factsCatalogue: FactsCatalogueV1 = {
  $schema: 'cv.facts.v1',
  assets: [],
  evidence: [],
  locale: 'en',
  sections: [
    {
      facts: [{ id: 'fact.certification', text: 'Cloud certified.' }],
      kind: 'identity',
      languages: [
        {
          id: 'identity.languages.0',
          name: 'English',
          proficiency: 'Fluent',
        },
      ],
      location: 'London, UK',
      name: 'Ada Example',
    },
    {
      items: [
        {
          id: 'contact.email',
          kind: 'email',
          label: 'Work email',
          url: 'mailto:ada@example.test',
          value: 'ada@example.test',
          visibility: 'public',
        },
        {
          id: 'contact.phone',
          kind: 'phone',
          value: '+44 20 7946 0958',
          visibility: 'public',
        },
        {
          id: 'contact.telegram',
          kind: 'telegram',
          label: 'Telegram',
          url: 'https://t.me/ada',
          value: '@ada',
          visibility: 'public',
        },
      ],
      kind: 'contact',
    },
    {
      entries: [
        {
          company: 'Analytical Engines',
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
    {
      entries: [
        {
          degree: 'Mathematics',
          details: [],
          id: 'education.mathematics',
          institution: 'University of London',
          location: 'London, UK',
          period: '2019-2023',
        },
      ],
      kind: 'education',
    },
    {
      groups: [
        {
          id: 'skills.engineering',
          skills: [{ id: 'skill.effect', name: 'Effect' }],
          title: 'Engineering',
        },
      ],
      kind: 'skills',
    },
    {
      entries: [
        {
          contributions: [],
          id: 'project.registry',
          links: [
            {
              id: 'project.registry.links.0',
              label: 'Project site',
              url: 'https://projects.example.test/registry',
              visibility: 'public',
            },
          ],
          name: 'Registry Toolkit',
          summary: {
            id: 'project.registry.summary',
            text: 'A registry toolkit.',
          },
          technologies: [],
          visibility: 'public',
        },
      ],
      kind: 'projects',
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

const validEducation: CvDocumentV1['education'][number] = {
  details: [],
  id: 'education.mathematics',
  institution: 'University of London',
  qualification: 'Mathematics',
}

const validSkills: CvDocumentV1['skills'][number] = {
  id: 'skills.engineering',
  items: ['Effect'],
  label: 'Engineering',
}

const validProject: CvDocumentV1['projects'][number] = {
  highlights: [],
  id: 'project.registry',
  links: [
    {
      href: 'https://projects.example.test/registry',
      kind: 'website',
      label: 'Project site',
      value: 'Project site',
    },
  ],
  name: 'Registry Toolkit',
  summary: 'A registry toolkit.',
  technologies: [],
}

const validEmailContact: CvDocumentV1['person']['contacts'][number] = {
  href: 'mailto:ada@example.test',
  kind: 'email',
  label: 'Work email',
  value: 'ada@example.test',
}

const validPhoneContact: CvDocumentV1['person']['contacts'][number] = {
  kind: 'phone',
  label: 'Mobile',
  value: '+44 20 7946 0958',
}

const validTelegramContact: CvDocumentV1['person']['contacts'][number] = {
  href: 'https://t.me/ada',
  kind: 'other',
  label: 'Telegram',
  value: '@ada',
}

const validCv: CvDocumentV1 = {
  $schema: 'cv.document.v1',
  additionalSections: [validAdditionalSection],
  direction: 'ltr',
  education: [],
  experience: [validExperience],
  locale: 'en',
  person: {
    contacts: [validEmailContact, validPhoneContact, validTelegramContact],
    headline: 'Platform engineer',
    location: 'London, UK',
    name: 'Ada Example',
    summary: 'Builds reliable systems.',
  },
  projects: [validProject],
  skills: [],
}

const failureOf = <A>(effect: Effect.Effect<A, PreparationWorkflowError>) =>
  Effect.runPromise(Effect.flip(effect))

describe('CV provenance validation', () => {
  test('checks copied metadata and additional reviewed evidence IDs', async () => {
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
      'fact.invented is not a reviewed additional-section evidence ID'
    )

    await Effect.runPromise(
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
  })

  test('accepts reviewed language IDs in additional sections', async () => {
    await Effect.runPromise(
      validateCvProvenance(factsCatalogue, {
        ...validCv,
        additionalSections: [
          {
            id: 'additional.languages',
            items: [
              {
                id: 'identity.languages.0',
                text: 'English — Fluent',
              },
            ],
            title: 'Languages',
          },
        ],
      })
    )
  })

  test('allows reviewed education dates and locations to be omitted', async () => {
    await Effect.runPromise(
      validateCvProvenance(factsCatalogue, {
        ...validCv,
        education: [validEducation],
      })
    )

    const changedPeriodError = await failureOf(
      validateCvProvenance(factsCatalogue, {
        ...validCv,
        education: [{ ...validEducation, period: '2020-2024' }],
      })
    )
    expect(changedPeriodError.message).toContain(
      'education:education.mathematics.period was changed'
    )
  })

  test('returns path-addressed issues and treats skill labels as copied metadata', () => {
    const issues = cvProvenanceIssues(factsCatalogue, {
      ...validCv,
      experience: [{ ...validExperience, company: 'Invented Employer' }],
      skills: [
        {
          ...validSkills,
          items: ['Effect', 'Invented Skill'],
          label: 'Invented Group',
        },
      ],
    })

    expect(issues).toContainEqual({
      message: 'experience:experience.engine.company was changed',
      path: ['experience', 0, 'company'],
    })
    expect(issues).toContainEqual({
      message: 'skills:skills.engineering.label was changed',
      path: ['skills', 0, 'label'],
    })
    expect(issues).toContainEqual({
      message: 'skills:skills.engineering.item:Invented Skill is unsupported',
      path: ['skills', 0, 'items', 1],
    })
  })

  test('treats reviewed contact value, kind, URL presence, and supplied labels as immutable', async () => {
    const contactIssues = (
      contact: CvDocumentV1['person']['contacts'][number]
    ) =>
      cvProvenanceIssues(factsCatalogue, {
        ...validCv,
        person: {
          ...validCv.person,
          contacts: [contact, validPhoneContact],
        },
      })

    expect(
      contactIssues({ ...validEmailContact, value: 'invented@example.test' })
    ).toContainEqual({
      message: 'contact:contact.email.value was changed',
      path: ['person', 'contacts', 0, 'value'],
    })
    expect(
      contactIssues({ ...validEmailContact, kind: 'phone' })
    ).toContainEqual({
      message: 'contact:contact.email.kind was changed',
      path: ['person', 'contacts', 0, 'kind'],
    })
    expect(
      contactIssues({
        ...validEmailContact,
        href: 'mailto:invented@example.test',
      })
    ).toContainEqual({
      message: 'contact:contact.email.href was changed',
      path: ['person', 'contacts', 0, 'href'],
    })
    expect(
      contactIssues({
        kind: 'email',
        label: 'Work email',
        value: 'ada@example.test',
      })
    ).toContainEqual({
      message: 'contact:contact.email.href was changed',
      path: ['person', 'contacts', 0, 'href'],
    })
    expect(
      contactIssues({ ...validEmailContact, label: 'Invented label' })
    ).toContainEqual({
      message: 'contact:contact.email.label was changed',
      path: ['person', 'contacts', 0, 'label'],
    })

    expect(
      cvProvenanceIssues(factsCatalogue, {
        ...validCv,
        person: {
          ...validCv.person,
          contacts: [
            validEmailContact,
            {
              ...validPhoneContact,
              href: 'tel:+442079460958',
              label: 'Personal mobile',
            },
          ],
        },
      })
    ).toContainEqual({
      message: 'contact:contact.phone.href was changed',
      path: ['person', 'contacts', 1, 'href'],
    })
    expect(
      cvProvenanceIssues(factsCatalogue, {
        ...validCv,
        person: {
          ...validCv.person,
          contacts: [
            validEmailContact,
            { ...validPhoneContact, label: 'Personal mobile' },
          ],
        },
      })
    ).toEqual([])

    const saveError = await failureOf(
      validateCvProvenance(factsCatalogue, {
        ...validCv,
        person: {
          ...validCv.person,
          contacts: [
            {
              ...validEmailContact,
              value: 'invented@example.test',
            },
            validPhoneContact,
          ],
        },
      })
    )
    expect(saveError.message).toContain(
      'contact:contact.email.value was changed'
    )
  })

  test('rejects changed project-link display fields and hrefs with exact paths', async () => {
    const changedDisplayFields = {
      ...validCv,
      projects: [
        {
          ...validProject,
          links: [
            {
              ...validProject.links[0],
              label: 'Invented label',
              value: 'Invented value',
            },
          ],
        },
      ],
    }
    const displayIssues = cvProvenanceIssues(
      factsCatalogue,
      changedDisplayFields
    )

    expect(displayIssues).toContainEqual({
      message: 'project:project.registry.link:0.label was changed',
      path: ['projects', 0, 'links', 0, 'label'],
    })
    expect(displayIssues).toContainEqual({
      message: 'project:project.registry.link:0.value was changed',
      path: ['projects', 0, 'links', 0, 'value'],
    })

    const changedHrefIssues = cvProvenanceIssues(factsCatalogue, {
      ...validCv,
      projects: [
        {
          ...validProject,
          links: [
            {
              ...validProject.links[0],
              href: 'https://invented.example.test',
            },
          ],
        },
      ],
    })
    expect(changedHrefIssues).toContainEqual({
      message: 'project:project.registry.link:0.href was changed',
      path: ['projects', 0, 'links', 0, 'href'],
    })

    const missingHrefIssues = cvProvenanceIssues(factsCatalogue, {
      ...validCv,
      projects: [
        {
          ...validProject,
          links: [
            {
              kind: 'website',
              label: 'Project site',
              value: 'Project site',
            },
          ],
        },
      ],
    })
    expect(missingHrefIssues).toContainEqual({
      message: 'project:project.registry.link:0.href was changed',
      path: ['projects', 0, 'links', 0, 'href'],
    })

    const saveError = await failureOf(
      validateCvProvenance(factsCatalogue, changedDisplayFields)
    )
    expect(saveError.message).toContain(
      'project:project.registry.link:0.label was changed'
    )
    expect(saveError.message).toContain(
      'project:project.registry.link:0.value was changed'
    )
  })
})
