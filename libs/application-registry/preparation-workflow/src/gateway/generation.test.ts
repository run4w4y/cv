import { describe, expect, test } from 'bun:test'
import type {
  Application,
  ContentEntry,
  JobPostingSnapshot,
} from '@cv/application-registry-entity'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Effect } from 'effect'

import type {
  CoverLetterPreparationInput,
  CvPreparationInput,
  EvidencePlan,
  JobAnalysis,
  PreparationBootstrap,
} from '../domain'
import type {
  StructuredGenerationRequest,
  StructuredGenerationShape,
} from '../generation/service'
import { cvGenerationGuidanceTestFixture } from '../test-support'
import { makePreparationGenerationGateway } from './generation'

const application: Application = {
  applicationStatus: 'preparing',
  appliedAt: null,
  company: 'Example',
  createdAt: '2026-07-23T00:00:00.000Z',
  followUpAt: null,
  id: 'application-1',
  listingAvailability: 'open',
  listingCheckedAt: null,
  listingClosedCandidateAt: null,
  listingConfidence: null,
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  location: null,
  personalPriority: null,
  postingUrl: 'https://jobs.example.test/platform',
  role: 'Platform Engineer',
  targetStage: 'backlog',
  updatedAt: '2026-07-23T00:00:00.000Z',
  updatedRevision: 1,
  version: 1,
}

const entry: ContentEntry = {
  applicationId: application.id,
  approvedRevisionId: null,
  createdAt: application.createdAt,
  headRevisionId: null,
  id: 'cover-letter-entry-1',
  kind: 'cover_letter',
  locale: 'en',
  state: 'draft',
  updatedAt: application.updatedAt,
  version: 1,
}

const jobSnapshot: JobPostingSnapshot = {
  applicationId: application.id,
  errorCode: null,
  errorMessage: null,
  fetchedAt: application.createdAt,
  fetcherVersion: 'test/v1',
  finalUrl: application.postingUrl,
  id: 'snapshot-1',
  normalizedByteLength: 20,
  normalizedMediaType: 'text/plain',
  normalizedObjectKey: 'objects/snapshot-1',
  normalizedSha256: 'abc',
  rawByteLength: null,
  rawMediaType: null,
  rawObjectKey: null,
  rawSha256: null,
  requestedUrl: application.postingUrl,
  status: 'fetched',
}

const factsCatalogue: FactsCatalogueV1 = {
  $schema: 'cv.facts.v1',
  assets: [],
  evidence: [],
  locale: 'en',
  sections: [
    {
      facts: [
        {
          id: 'identity.facts.0',
          text: 'Open to relocation to Tokyo.',
        },
      ],
      kind: 'identity',
      languages: [
        {
          id: 'identity.languages.0',
          name: 'English',
          proficiency: 'Fluent',
        },
        {
          id: 'identity.languages.1',
          name: 'Russian',
          proficiency: 'Native',
        },
        {
          id: 'identity.languages.2',
          name: 'Japanese',
          proficiency: 'Beginner',
        },
      ],
      name: 'Ada Example',
    },
    {
      items: [
        {
          id: 'contact.items.0',
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
          company: 'Independent',
          highlights: [],
          id: 'experience.entries.0',
          location: 'Remote',
          period: '2020-present',
          roles: ['Software Engineer'],
          technologies: ['Effect'],
          workstreams: [],
        },
      ],
      kind: 'experience',
    },
    {
      entries: [
        {
          degree: 'Computer Science',
          details: [],
          id: 'education.entries.0',
          institution: 'Innopolis University',
          period: '2016-2020',
        },
      ],
      kind: 'education',
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

const approvedCv = {
  $schema: 'cv.document.v1' as const,
  additionalSections: [],
  direction: 'ltr' as const,
  education: [],
  experience: [],
  locale: 'en',
  person: {
    contacts: [],
    headline: 'Platform Engineer',
    name: 'Ada Example',
    summary: 'Builds reliable product and platform systems.',
  },
  projects: [],
  skills: [],
}

const bootstrap: PreparationBootstrap = {
  application,
  cvGenerationGuidance: cvGenerationGuidanceTestFixture,
  entry,
  factsCatalogue,
  factsReleaseId: 'facts-release-1',
  jobContext: 'Platform role requiring Effect.',
  jobSnapshot,
  referenceCv: approvedCv,
  referenceCvRevisionId: 'revision-cv-1',
}

const input: CoverLetterPreparationInput = {
  kind: 'cover_letter',
  locale: 'en',
  prompt: 'Keep it concise.',
  runId: 'cover-letter-run-1',
  source: {
    _tag: 'ReviewedContext',
    applicationId: application.id,
    factsReleaseId: 'facts-release-1',
    jobSnapshotId: jobSnapshot.id,
    url: application.postingUrl,
  },
}

const cvInput: CvPreparationInput = {
  generationGuidance: cvGenerationGuidanceTestFixture,
  kind: 'cv',
  locale: 'en',
  runId: 'cv-run-1',
  source: input.source,
}

const analysis: JobAnalysis = {
  company: application.company,
  educationDatesRequired: false,
  keywords: ['Effect'],
  location: null,
  requirements: [
    {
      id: 'req.effect',
      priority: 'required',
      text: 'Professional Effect experience.',
    },
  ],
  responsibilities: ['Build reliable systems.'],
  role: application.role,
  summary: 'A platform engineering role.',
}

const generationHarness = (
  outputs: ReadonlyArray<unknown>
): {
  readonly generation: StructuredGenerationShape
  readonly requests: ReadonlyArray<StructuredGenerationRequest>
} => {
  const requests: Array<StructuredGenerationRequest> = []
  let index = 0
  const generation: StructuredGenerationShape = {
    generate: Effect.fn('StructuredGeneration.GenerationTest.generate')(
      function* (request) {
        requests.push(request)
        const output = outputs[index]
        index += 1
        if (output === undefined) {
          return yield* Effect.die('Missing structured generation test output.')
        }
        return {
          executor: 'codex-test',
          output,
          usage: {
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
          },
        }
      }
    ),
  }
  return { generation, requests }
}

describe('preparation generation gateway evidence grounding', () => {
  test('repairs a semantically invalid evidence plan once', async () => {
    const harness = generationHarness([
      {
        requirements: [
          {
            evidenceIds: ['skills.groups.9.skills.9'],
            requirementId: 'req.effect',
          },
        ],
      },
      {
        requirements: [
          {
            evidenceIds: ['skills.groups.0.skills.2'],
            requirementId: 'req.effect',
          },
        ],
      },
    ])
    const gateway = await Effect.runPromise(
      makePreparationGenerationGateway(harness.generation, 1)
    )
    const result = await Effect.runPromise(
      gateway.planEvidence(input, bootstrap, analysis)
    )

    expect(harness.requests).toHaveLength(2)
    expect(harness.requests.at(0)?.prompt).toContain(
      '"id": "skills.groups.0.skills.2"'
    )
    expect(harness.requests.at(0)?.prompt).toContain(
      '"id": "identity.languages.0"'
    )
    expect(harness.requests.at(1)?.prompt).toContain(
      'unknown evidence IDs: skills.groups.9.skills.9'
    )
    expect(result.plan.requirements[0]?.evidenceIds).toEqual([
      'skills.groups.0.skills.2',
    ])
    expect(result.metadata).toEqual({
      executor: 'codex-test',
      stage: 'evidence',
      usage: {
        inputTokens: 20,
        outputTokens: 10,
        totalTokens: 30,
      },
    })
  })

  test('repairs a CV authoring plan that drops reviewed employment', async () => {
    const validPlan = {
      additionalEvidenceIds: [],
      education: [],
      experience: [
        {
          evidenceIds: ['experience.entries.0'],
          id: 'experience.entries.0',
        },
      ],
      profileEvidenceIds: ['skills.groups.0.skills.2'],
      projects: [],
      skillGroups: [
        {
          evidenceIds: ['skills.groups.0.skills.2'],
          id: 'skills.groups.0',
        },
      ],
    }
    const harness = generationHarness([
      {
        ...validPlan,
        experience: [],
      },
      validPlan,
    ])
    const gateway = await Effect.runPromise(
      makePreparationGenerationGateway(harness.generation, 1)
    )
    const plan: EvidencePlan = {
      requirements: [
        {
          evidenceIds: ['experience.entries.0', 'skills.groups.0.skills.2'],
          requirementId: 'req.effect',
        },
      ],
    }
    const result = await Effect.runPromise(
      gateway.planCv(cvInput, bootstrap, analysis, plan)
    )

    expect(harness.requests).toHaveLength(2)
    expect(harness.requests[0]?.prompt).toContain('"minimumItems": 1')
    expect(harness.requests[1]?.prompt).toContain(
      'experience must include at least 1 items; received 0'
    )
    expect(result.plan).toEqual(validPlan)
    expect(result.metadata).toMatchObject({
      stage: 'planning',
      usage: {
        inputTokens: 20,
        outputTokens: 10,
        totalTokens: 30,
      },
    })
  })

  test('composes a cover letter directly from selected evidence', async () => {
    const harness = generationHarness([
      {
        $schema: 'cover-letter.v1',
        body: 'I use Effect to build reliable systems.',
        locale: 'en',
        referenceCvRevisionId: 'revision-cv-1',
      },
    ])
    const gateway = await Effect.runPromise(
      makePreparationGenerationGateway(harness.generation, 1)
    )
    const plan: EvidencePlan = {
      requirements: [
        {
          evidenceIds: ['skills.groups.0.skills.2'],
          requirementId: 'req.effect',
        },
      ],
    }
    const composed = await Effect.runPromise(
      gateway.composeCoverLetter(input, bootstrap, analysis, plan)
    )

    const compositionPrompt = harness.requests.at(0)?.prompt
    expect(compositionPrompt).toContain('"id": "skills.groups.0.skills.2"')
    expect(compositionPrompt).not.toContain('"name": "English"')
    expect(composed).toMatchObject({
      _tag: 'CoverLetter',
      document: {
        body: 'I use Effect to build reliable systems.',
      },
    })
  })

  test('repairs invented final-document IDs from exact provenance bindings', async () => {
    const sharedDocument = {
      $schema: 'cv.document.v1',
      direction: 'ltr',
      experienceDuration: '6 years',
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
        headline: 'Independent software engineer',
        name: 'Ada Example',
        summary:
          'Senior software engineer building reliable product and platform systems with Effect and TypeScript. Owns architecture, implementation, delivery, and production support across independent projects, translating complex product needs into maintainable software for demanding customer workflows and cross-functional teams.',
      },
      projects: [],
      skills: [],
    }
    const harness = generationHarness([
      {
        ...sharedDocument,
        additionalSections: [
          {
            id: 'languages',
            items: [
              { id: 'english', text: 'English — Fluent' },
              { id: 'russian', text: 'Russian — Native' },
              { id: 'japanese', text: 'Japanese — Beginner' },
            ],
            title: 'Languages',
          },
          {
            id: 'relocation',
            items: [
              {
                id: 'tokyo-relocation',
                text: 'Open to relocation to Tokyo.',
              },
            ],
            title: 'Relocation',
          },
        ],
        education: [
          {
            details: [],
            id: 'innopolis-university',
            institution: 'Innopolis University',
            qualification: 'Computer Science',
          },
        ],
        experience: [
          {
            company: 'Independent',
            highlights: ['Builds reliable software.'],
            id: 'independent-software-engineer',
            location: 'Remote',
            period: '2020-present',
            role: 'Software Engineer',
            summary: 'Independent product and platform engineering.',
            technologies: ['Effect'],
          },
        ],
      },
      {
        ...sharedDocument,
        additionalSections: [
          {
            id: 'languages',
            items: [
              {
                id: 'identity.languages.0',
                text: 'English — Fluent',
              },
              {
                id: 'identity.languages.1',
                text: 'Russian — Native',
              },
              {
                id: 'identity.languages.2',
                text: 'Japanese — Beginner',
              },
            ],
            title: 'Languages',
          },
          {
            id: 'relocation',
            items: [
              {
                id: 'identity.facts.0',
                text: 'Open to relocation to Tokyo.',
              },
            ],
            title: 'Relocation',
          },
        ],
        education: [
          {
            details: [],
            id: 'education.entries.0',
            institution: 'Innopolis University',
            qualification: 'Computer Science',
          },
        ],
        experience: [
          {
            company: 'Independent',
            highlights: ['Builds reliable software.'],
            id: 'experience.entries.0',
            location: 'Remote',
            period: '2020-present',
            role: 'Software Engineer',
            summary: 'Independent product and platform engineering.',
            technologies: ['Effect'],
          },
        ],
      },
    ])
    const gateway = await Effect.runPromise(
      makePreparationGenerationGateway(harness.generation, 1)
    )
    const authoringPlan = {
      additionalEvidenceIds: [
        'identity.languages.0',
        'identity.languages.1',
        'identity.languages.2',
        'identity.facts.0',
      ],
      education: [
        {
          evidenceIds: ['education.entries.0'],
          id: 'education.entries.0',
        },
      ],
      experience: [
        {
          evidenceIds: ['experience.entries.0'],
          id: 'experience.entries.0',
        },
      ],
      profileEvidenceIds: ['skills.groups.0.skills.2'],
      projects: [],
      skillGroups: [],
    }
    const composed = await Effect.runPromise(
      gateway.composeCv(cvInput, bootstrap, analysis, authoringPlan)
    )

    expect(harness.requests).toHaveLength(2)
    expect(harness.requests.at(0)?.prompt).toContain(
      'Final CV authoring packet.'
    )
    expect(harness.requests.at(0)?.prompt).toContain(
      '"id": "experience.entries.0"'
    )
    expect(harness.requests.at(0)?.prompt).toContain('"id": "identity.facts.0"')
    expect(harness.requests.at(0)?.prompt).not.toContain('"rationale"')
    expect(harness.requests.at(0)?.prompt).not.toContain('"strategy"')
    expect(harness.requests.at(1)?.prompt).toContain(
      'experience:independent-software-engineer is absent from the facts catalogue'
    )
    expect(harness.requests.at(1)?.prompt).toContain(
      'additional:languages:english is not a reviewed additional-section evidence ID'
    )
    expect(composed).toMatchObject({
      _tag: 'Cv',
      document: {
        additionalSections: [
          {
            items: [
              { id: 'identity.languages.0' },
              { id: 'identity.languages.1' },
              { id: 'identity.languages.2' },
            ],
          },
          {
            items: [{ id: 'identity.facts.0' }],
          },
        ],
        education: [{ id: 'education.entries.0' }],
        experience: [{ id: 'experience.entries.0' }],
      },
      metadata: [
        {
          stage: 'composition',
          usage: {
            inputTokens: 20,
            outputTokens: 10,
            totalTokens: 30,
          },
        },
      ],
    })
  })
})
