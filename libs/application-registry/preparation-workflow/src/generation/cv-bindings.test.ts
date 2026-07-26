import { describe, expect, test } from 'bun:test'
import {
  CvAdditionalItemV1Schema,
  CvExperienceItemV1Schema,
  CvProjectItemV1Schema,
  CvSkillGroupV1Schema,
} from '@cv/contracts/document'
import { FactsCatalogueV1Schema } from '@cv/contracts/facts'
import { Schema } from 'effect'

import { cvAuthoringSourceForGeneration } from './cv-bindings'

const validTechnologies = Array.from(
  { length: 20 },
  (_, index) => `Technology ${index + 1}`
)
const validSkills = Array.from({ length: 30 }, (_, index) => ({
  id: `skill.${index + 1}`,
  name: `Skill ${index + 1}`,
}))
const oversizedTechnology = 'x'.repeat(81)

const catalogue = Schema.decodeUnknownSync(FactsCatalogueV1Schema)({
  $schema: 'cv.facts.v1',
  assets: [],
  evidence: [],
  locale: 'en',
  sections: [
    {
      facts: [
        {
          id: 'fact.too-long-for-additional',
          text: 'A'.repeat(501),
        },
      ],
      kind: 'identity',
      languages: [
        {
          id: 'language.fr',
          name: 'French',
          proficiency: 'Conversational',
        },
      ],
      name: 'Ada Example',
    },
    {
      entries: [
        {
          company: 'No Role Ltd',
          highlights: [],
          id: 'experience.no-role',
          period: '2020–2021',
          roles: [],
          technologies: [],
          workstreams: [],
        },
        {
          company: 'Northstar',
          highlights: [],
          id: 'experience.northstar',
          period: '2021–Present',
          roles: ['Staff Platform Engineer'],
          technologies: [
            ...validTechnologies,
            validTechnologies[0],
            oversizedTechnology,
          ],
          workstreams: [],
        },
      ],
      kind: 'experience',
    },
    {
      entries: [
        {
          contributions: [],
          id: 'project.compiler',
          links: Array.from({ length: 6 }, (_, index) => ({
            id: `project-link.${index + 1}`,
            label: `Project link ${index + 1}`,
            url: `https://example.test/project/${index + 1}`,
            visibility: 'public',
          })),
          name: 'Schema compiler',
          summary: {
            id: 'fact.project-summary',
            text: 'Compiles schemas into deterministic runtime validators.',
          },
          technologies: [
            ...validTechnologies,
            validTechnologies[0],
            oversizedTechnology,
          ],
          visibility: 'public',
        },
      ],
      kind: 'projects',
    },
    {
      items: [
        {
          id: 'contact.email',
          kind: 'email',
          label: 'Email',
          url: 'mailto:ada@example.test',
          value: 'ada@example.test',
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
        {
          id: 'contact.social',
          kind: 'social',
          value: '@ada-social',
          visibility: 'public',
        },
      ],
      kind: 'contact',
    },
    {
      groups: [
        {
          id: 'skills.empty',
          skills: [],
          title: 'Empty',
        },
        {
          id: 'skills.invalid',
          skills: [
            {
              id: 'skill.invalid',
              name: oversizedTechnology,
            },
          ],
          title: 'Invalid',
        },
        {
          id: 'skills.engineering',
          skills: [
            ...validSkills,
            {
              id: 'skill.duplicate',
              name: validSkills[0]?.name,
            },
            {
              id: 'skill.too-long',
              name: oversizedTechnology,
            },
          ],
          title: 'Engineering',
        },
      ],
      kind: 'skills',
    },
  ],
})

describe('cvAuthoringSourceForGeneration', () => {
  test('projects reviewed arrays into the exact CV contract bounds', () => {
    const bindings = cvAuthoringSourceForGeneration(catalogue)

    expect(bindings.experience.map(({ id }) => id)).toEqual([
      'experience.northstar',
    ])
    expect(bindings.experience[0]?.technologies).toEqual(
      validTechnologies.slice(0, 16)
    )
    expect(
      Schema.is(CvExperienceItemV1Schema.fields.technologies)(
        bindings.experience[0]?.technologies
      )
    ).toBe(true)

    expect(bindings.person.contacts).toEqual([
      {
        kind: 'email',
        label: 'Email',
        sourceId: 'contact.email',
        url: 'mailto:ada@example.test',
        value: 'ada@example.test',
      },
      {
        kind: 'other',
        label: 'Telegram',
        sourceId: 'contact.telegram',
        url: 'https://t.me/ada',
        value: '@ada',
      },
      {
        kind: 'other',
        sourceId: 'contact.social',
        value: '@ada-social',
      },
    ])

    expect(bindings.projects[0]?.technologies).toEqual(
      validTechnologies.slice(0, 16)
    )
    expect(bindings.projects[0]?.links).toHaveLength(4)
    expect(
      Schema.is(CvProjectItemV1Schema.fields.technologies)(
        bindings.projects[0]?.technologies
      )
    ).toBe(true)
    expect(
      Schema.is(CvProjectItemV1Schema.fields.links)(
        bindings.projects[0]?.links.map(({ label, url }) => ({
          href: url,
          kind: 'website',
          label,
          value: label,
        }))
      )
    ).toBe(true)

    expect(bindings.skillGroups.map(({ id }) => id)).toEqual([
      'skills.engineering',
    ])
    expect(bindings.skillGroups[0]?.items).toEqual(
      validSkills.slice(0, 24).map(({ name }) => name)
    )
    expect(
      Schema.is(CvSkillGroupV1Schema.fields.items)(
        bindings.skillGroups[0]?.items
      )
    ).toBe(true)
  })

  test('omits additional facts that cannot be copied into a CV item', () => {
    const bindings = cvAuthoringSourceForGeneration(catalogue)

    expect(bindings.additionalSectionItems.map(({ id }) => id)).toEqual([
      'language.fr',
      'fact.project-summary',
    ])
    expect(bindings.additionalSectionItems[0]).toMatchObject({
      id: 'language.fr',
      label: 'French',
      sectionTitle: 'Identity language',
    })
    for (const binding of bindings.additionalSectionItems) {
      expect(
        Schema.is(CvAdditionalItemV1Schema)({
          id: binding.id,
          text: binding.label,
        })
      ).toBe(true)
    }
  })
})
