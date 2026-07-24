import { describe, expect, test } from 'bun:test'
import type {
  Application,
  ContentEntry,
  JobPostingSnapshot,
} from '@cv/application-registry-entity'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Effect } from 'effect'

import type {
  EvidencePlan,
  JobAnalysis,
  PreparationBootstrap,
  PreparationWorkflowInput,
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
      facts: [],
      kind: 'identity',
      languages: [
        {
          id: 'identity.languages.0',
          name: 'English',
          proficiency: 'Fluent',
        },
      ],
      name: 'Ada Example',
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

const bootstrap: PreparationBootstrap = {
  application,
  cvGenerationGuidance: cvGenerationGuidanceTestFixture,
  entry,
  factsCatalogue,
  factsReleaseId: 'facts-release-1',
  jobContext: 'Platform role requiring Effect.',
  jobSnapshot,
  referenceCv: null,
  referenceCvRevisionId: null,
}

const input: PreparationWorkflowInput = {
  coverLetterPrompt: 'Keep it concise.',
  cvGenerationGuidance: null,
  kind: 'cover_letter',
  locale: 'en',
  runId: 'cover-letter-run-1',
  source: {
    _tag: 'ReviewedContext',
    applicationId: application.id,
    factsReleaseId: 'facts-release-1',
    jobSnapshotId: jobSnapshot.id,
    url: application.postingUrl,
  },
}

const analysis: JobAnalysis = {
  company: application.company,
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
        matches: [
          {
            evidenceIds: ['skills.groups.9.skills.9'],
            rationale: 'Invalid generated citation.',
            requirementId: 'req.effect',
          },
        ],
        strategy: 'Use skills.',
        uncoveredRequirementIds: [],
      },
      {
        matches: [
          {
            evidenceIds: ['skills.groups.0.skills.2'],
            rationale: 'The reviewed skill directly supports the requirement.',
            requirementId: 'req.effect',
          },
        ],
        strategy: 'Use reviewed Effect experience.',
        uncoveredRequirementIds: [],
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
    expect(result.plan.matches[0]?.evidenceIds).toEqual([
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

  test('resolves selected evidence for briefs and the final author', async () => {
    const harness = generationHarness([
      {
        evidenceIds: ['skills.groups.0.skills.2'],
        notes: ['Explain the relevance in natural prose.'],
        objective: 'Ground the evidence paragraph.',
        sectionId: 'evidence',
      },
      {
        $schema: 'cover-letter.v1',
        body: 'I use Effect to build reliable systems.',
        locale: 'en',
      },
    ])
    const gateway = await Effect.runPromise(
      makePreparationGenerationGateway(harness.generation, 1)
    )
    const plan: EvidencePlan = {
      matches: [
        {
          evidenceIds: ['skills.groups.0.skills.2'],
          rationale: 'Direct reviewed skill evidence.',
          requirementId: 'req.effect',
        },
      ],
      strategy: 'Lead with relevant platform experience.',
      uncoveredRequirementIds: [],
    }
    const brief = await Effect.runPromise(
      gateway.brief(input, bootstrap, analysis, plan, 'evidence')
    )
    const composed = await Effect.runPromise(
      gateway.compose(input, bootstrap, analysis, plan, [brief.brief])
    )

    const briefPrompt = harness.requests.at(0)?.prompt
    expect(briefPrompt).toContain('"label": "Effect"')
    expect(briefPrompt).not.toContain('"label": "English"')

    const compositionPrompt = harness.requests.at(1)?.prompt
    expect(compositionPrompt).toContain(
      'Author one coherent, role-specific document in original prose.'
    )
    expect(compositionPrompt).toContain('"id": "skills.groups.0.skills.2"')
    expect(compositionPrompt).toContain('"name": "English"')
    expect(composed).toMatchObject({
      _tag: 'CoverLetter',
      document: {
        body: 'I use Effect to build reliable systems.',
      },
    })
  })
})
