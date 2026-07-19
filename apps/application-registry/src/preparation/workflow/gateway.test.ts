import { describe, expect, test } from 'bun:test'
import type { CvDocumentV1 } from '@cv/contracts/document'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Effect } from 'effect'
import type {
  EvidencePlan,
  JobAnalysis,
  PreparationWorkflowError,
  SectionBrief,
} from './domain'

import {
  decodeOpaqueValue,
  validateCvProvenance,
  validateEvidencePlan,
  validateJobAnalysis,
  validateSectionBrief,
} from './gateway'

test('malformed opaque registry payloads stay in the typed workflow error channel', async () => {
  const result = await Effect.runPromise(
    Effect.result(
      decodeOpaqueValue('facts', {
        data: 'not base64!',
        mediaType: 'application/json',
      })
    )
  )

  expect(result._tag).toBe('Failure')
  if (result._tag === 'Failure') {
    expect(result.failure._tag).toBe('PreparationWorkflowError')
    expect(result.failure.stage).toBe('facts')
  }
})

const factsCatalogue: FactsCatalogueV1 = {
  $schema: 'cv.facts.v1',
  assets: [],
  evidence: [],
  locale: 'en',
  sections: [
    {
      facts: [
        { id: 'fact.platforms', text: 'Built reliable platforms.' },
        { id: 'fact.certification', text: 'Holds a cloud certification.' },
      ],
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
        {
          id: 'contact.private',
          kind: 'phone',
          value: '+1 555 0100',
          visibility: 'private',
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
          highlights: [
            {
              id: 'fact.private-work',
              text: 'Delivered confidential client work.',
            },
          ],
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

const effectRequirement: JobAnalysis['requirements'][number] = {
  id: 'req.effect',
  priority: 'required',
  text: 'Know Effect.',
}

const queuesRequirement: JobAnalysis['requirements'][number] = {
  id: 'req.queues',
  priority: 'preferred',
  text: 'Build queues.',
}

const analysis: JobAnalysis = {
  company: 'Example Corp',
  keywords: [],
  location: null,
  requirements: [effectRequirement, queuesRequirement],
  responsibilities: [],
  role: 'Platform engineer',
  summary: 'A platform role.',
}

const validEvidenceMatch: EvidencePlan['matches'][number] = {
  factIds: ['fact.platforms'],
  rationale: 'Direct platform experience.',
  requirementId: 'req.effect',
}

const validPlan: EvidencePlan = {
  matches: [validEvidenceMatch],
  strategy: 'Lead with platform experience.',
  uncoveredRequirementIds: ['req.queues'],
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

const failureOf = async <A>(
  effect: Effect.Effect<A, PreparationWorkflowError>
): Promise<PreparationWorkflowError> => Effect.runPromise(Effect.flip(effect))

describe('preparation workflow validation', () => {
  test('rejects duplicate requirement IDs in the job analysis', async () => {
    const error = await failureOf(
      validateJobAnalysis({
        ...analysis,
        requirements: [
          effectRequirement,
          { ...queuesRequirement, id: 'req.effect' },
        ],
      })
    )

    expect(error.stage).toBe('analysis')
    expect(error.message).toContain('duplicate requirement IDs: req.effect')
  })

  test('rejects evidence plans that omit a requirement', async () => {
    const error = await failureOf(
      validateEvidencePlan(analysis, factsCatalogue, {
        ...validPlan,
        uncoveredRequirementIds: [],
      })
    )

    expect(error.message).toContain('omitted requirement IDs: req.queues')
  })

  test('rejects a requirement covered by both a match and uncovered', async () => {
    const error = await failureOf(
      validateEvidencePlan(analysis, factsCatalogue, {
        ...validPlan,
        uncoveredRequirementIds: ['req.effect', 'req.queues'],
      })
    )

    expect(error.message).toContain(
      'covered requirement IDs more than once: req.effect'
    )
  })

  test('rejects extraneous requirement and unknown reviewed-fact IDs', async () => {
    const requirementError = await failureOf(
      validateEvidencePlan(analysis, factsCatalogue, {
        ...validPlan,
        uncoveredRequirementIds: ['req.queues', 'req.unknown'],
      })
    )
    expect(requirementError.message).toContain(
      'unknown requirement IDs: req.unknown'
    )

    const factError = await failureOf(
      validateEvidencePlan(analysis, factsCatalogue, {
        ...validPlan,
        matches: [
          {
            ...validEvidenceMatch,
            factIds: ['fact.unknown'],
          },
        ],
      })
    )
    expect(factError.message).toContain('unknown fact IDs: fact.unknown')

    const privateFactError = await failureOf(
      validateEvidencePlan(analysis, factsCatalogue, {
        ...validPlan,
        matches: [
          {
            ...validEvidenceMatch,
            factIds: ['fact.private-work'],
          },
        ],
      })
    )
    expect(privateFactError.message).toContain(
      'unknown fact IDs: fact.private-work'
    )
  })

  test('limits section briefs to reviewed facts selected by the evidence plan', async () => {
    const brief: SectionBrief = {
      factIds: ['fact.certification'],
      notes: [],
      objective: 'Summarize evidence.',
      sectionId: 'profile',
    }
    const error = await failureOf(
      validateSectionBrief(factsCatalogue, validPlan, 'profile', brief)
    )

    expect(error.message).toContain(
      'fact IDs outside the validated evidence plan: fact.certification'
    )
  })

  test('checks copied CV metadata and additional reviewed-fact IDs', async () => {
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
            items: [
              {
                ...validAdditionalItem,
                id: 'fact.invented',
              },
            ],
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
