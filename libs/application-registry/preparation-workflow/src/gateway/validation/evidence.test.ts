import { describe, expect, test } from 'bun:test'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Effect } from 'effect'
import type {
  EvidencePlan,
  JobAnalysis,
  PreparationWorkflowError,
} from '../../domain'
import { evidenceReferencesForGeneration } from '../../generation/prompts'

import { validateEvidencePlan } from './evidence'

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
}

const evidenceReferences = evidenceReferencesForGeneration(factsCatalogue)

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
  educationDatesRequired: false,
  keywords: [],
  location: null,
  requirements: [effectRequirement, queuesRequirement],
  responsibilities: [],
  role: 'Platform engineer',
  summary: 'A platform role.',
}

const validEvidenceMatch: EvidencePlan['requirements'][number] = {
  evidenceIds: ['fact.platforms'],
  requirementId: 'req.effect',
}

const validPlan: EvidencePlan = {
  requirements: [
    validEvidenceMatch,
    { evidenceIds: [], requirementId: 'req.queues' },
  ],
}

const failureOf = async <A>(
  effect: Effect.Effect<A, PreparationWorkflowError>
): Promise<PreparationWorkflowError> => Effect.runPromise(Effect.flip(effect))

describe('preparation workflow validation', () => {
  test('rejects evidence plans that omit a requirement', async () => {
    const error = await failureOf(
      validateEvidencePlan(analysis, evidenceReferences, {
        requirements: [validEvidenceMatch],
      })
    )

    expect(error.message).toContain('omitted requirement IDs: req.queues')
  })

  test('rejects duplicate requirement allocations', async () => {
    const error = await failureOf(
      validateEvidencePlan(analysis, evidenceReferences, {
        requirements: [
          validEvidenceMatch,
          validEvidenceMatch,
          { evidenceIds: [], requirementId: 'req.queues' },
        ],
      })
    )

    expect(error.message).toContain(
      'covered requirement IDs more than once: req.effect'
    )
  })

  test('rejects extraneous requirement and unknown evidence IDs', async () => {
    const requirementError = await failureOf(
      validateEvidencePlan(analysis, evidenceReferences, {
        requirements: [
          ...validPlan.requirements,
          { evidenceIds: [], requirementId: 'req.unknown' },
        ],
      })
    )
    expect(requirementError.message).toContain(
      'unknown requirement IDs: req.unknown'
    )

    const factError = await failureOf(
      validateEvidencePlan(analysis, evidenceReferences, {
        requirements: [
          {
            ...validEvidenceMatch,
            evidenceIds: ['fact.unknown'],
          },
          { evidenceIds: [], requirementId: 'req.queues' },
        ],
      })
    )
    expect(factError.message).toContain('unknown evidence IDs: fact.unknown')

    await Effect.runPromise(
      validateEvidencePlan(analysis, evidenceReferences, {
        requirements: [
          {
            ...validEvidenceMatch,
            evidenceIds: ['fact.private-work'],
          },
          { evidenceIds: [], requirementId: 'req.queues' },
        ],
      })
    )
  })

  test('accepts compiler-generated language and bare skill evidence IDs', async () => {
    await Effect.runPromise(
      validateEvidencePlan(analysis, evidenceReferences, {
        requirements: [
          {
            evidenceIds: ['identity.languages.0', 'skills.groups.0.skills.2'],
            requirementId: 'req.effect',
          },
          { evidenceIds: [], requirementId: 'req.queues' },
        ],
      })
    )
  })
})
