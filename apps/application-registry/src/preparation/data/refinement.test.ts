import { describe, expect, test } from 'bun:test'
import {
  StructuredGeneration,
  type StructuredGenerationRequest,
} from '@cv/application-preparation-workflow'
import type {
  ContentEntry,
  ContentRevision,
} from '@cv/application-registry-entity'
import type { CvDocumentV1 } from '@cv/contracts/document'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Cause, Effect, Exit, Layer, Option } from 'effect'
import * as Reactivity from 'effect/unstable/reactivity/Reactivity'
import {
  type RefinePreparationRevisionInput,
  refinePreparationRevision,
} from './refinement'
import { PreparationRepository } from './repository'
import type { PreparationDataError, PreparationRepositoryShape } from './types'

const recordedAt = '2026-07-23T00:00:00.000Z'

const entry = (kind: ContentEntry['kind']): ContentEntry => ({
  applicationId: 'application-1',
  approvedRevisionId: null,
  createdAt: recordedAt,
  headRevisionId: 'revision-1',
  id: `${kind}-entry-1`,
  kind,
  locale: 'en',
  state: 'draft',
  updatedAt: recordedAt,
  version: 2,
})

const revision = (
  contentEntry: ContentEntry,
  operationId: string
): ContentRevision => ({
  byteLength: 100,
  contentEntryId: contentEntry.id,
  contractId: contentEntry.kind === 'cv' ? 'cv.document.v1' : 'cover-letter.v1',
  contractVersion: '1',
  createdAt: recordedAt,
  factsReleaseId: 'facts-release-1',
  id: 'revision-2',
  jobSnapshotId: 'snapshot-1',
  mediaType: 'application/json',
  objectKey: 'objects/revision-2',
  operationId,
  parentRevisionId: 'revision-1',
  revisionNumber: 2,
  sha256: 'abc',
  source: 'ai_adjustment',
})

const factsCatalogue: FactsCatalogueV1 = {
  $schema: 'cv.facts.v1',
  assets: [],
  evidence: [],
  locale: 'en',
  sections: [
    {
      facts: [],
      kind: 'identity',
      languages: [],
      name: 'Ada Example',
    },
    {
      items: [
        {
          id: 'contact.email',
          kind: 'email',
          value: 'ada@example.test',
          visibility: 'public',
        },
      ],
      kind: 'contact',
    },
  ],
}

const validCv: CvDocumentV1 = {
  $schema: 'cv.document.v1',
  additionalSections: [],
  direction: 'ltr',
  education: [],
  experience: [],
  locale: 'en',
  person: {
    contacts: [
      {
        kind: 'email',
        label: 'Email',
        value: 'ada@example.test',
      },
    ],
    headline: 'Platform Engineer',
    name: 'Ada Example',
    summary: 'Builds reliable systems.',
  },
  projects: [],
  skills: [],
}

const unimplemented = <A>(): Effect.Effect<A, PreparationDataError> =>
  Effect.die('Repository operation is not used by this refinement test.')

const makeRepository = (
  overrides: Partial<PreparationRepositoryShape>
): PreparationRepositoryShape => ({
  appendRevision: () => unimplemented(),
  approveRevision: () => unimplemented(),
  createPreparationApplication: () => unimplemented(),
  loadBootstrap: () => unimplemented(),
  loadContentEntry: () => unimplemented(),
  loadContentHead: () => unimplemented(),
  loadContentRevisionHistory: () => unimplemented(),
  loadContext: () => unimplemented(),
  loadCvGenerationGuidance: () => unimplemented(),
  loadCvPageState: () => unimplemented(),
  loadPreparationHead: () => Effect.succeed(null),
  loadWorkflowBootstrap: () => unimplemented(),
  persistManualJobContext: () => unimplemented(),
  readCurrentPdf: () => unimplemented(),
  refreshSnapshot: () => unimplemented(),
  requestPdfGeneration: () => unimplemented(),
  setPublicationAvailability: () => unimplemented(),
  stageCv: () => unimplemented(),
  startPreparation: () => unimplemented(),
  updatePreparationApplication: () => unimplemented(),
  ...overrides,
})

const input = (contentEntry: ContentEntry): RefinePreparationRevisionInput => ({
  applicationId: contentEntry.applicationId,
  currentDocument:
    contentEntry.kind === 'cv'
      ? validCv
      : {
          $schema: 'cover-letter.v1',
          body: 'Original letter.',
          locale: 'en',
        },
  entry: contentEntry,
  factsCatalogue,
  factsReleaseId: 'facts-release-1',
  instruction: 'Make the opening more direct.',
  jobContext: 'Platform role',
  jobSnapshotId: 'snapshot-1',
  operationId: 'run-1:refinement:request-1',
})

const execute = (
  refinementInput: RefinePreparationRevisionInput,
  output: unknown,
  repository: PreparationRepositoryShape,
  requests: Array<StructuredGenerationRequest> = []
) =>
  Effect.runPromise(
    Effect.exit(refinePreparationRevision(refinementInput)).pipe(
      Effect.provide(
        Layer.mergeAll(
          Layer.succeed(PreparationRepository, repository),
          Layer.succeed(
            StructuredGeneration,
            StructuredGeneration.of({
              generate: (request) =>
                Effect.sync(() => {
                  requests.push(request)
                  return {
                    executor: 'test',
                    output,
                    usage: {
                      inputTokens: null,
                      outputTokens: null,
                      totalTokens: null,
                    },
                  }
                }),
            })
          ),
          Reactivity.layer
        )
      )
    )
  )

describe('preparation Codex refinement', () => {
  test('appends a schema-valid immutable cover-letter revision', async () => {
    const contentEntry = entry('cover_letter')
    const requests: Array<StructuredGenerationRequest> = []
    const appended: Array<
      Parameters<PreparationRepositoryShape['appendRevision']>[0]
    > = []
    const output = {
      $schema: 'cover-letter.v1',
      body: 'A more direct letter.',
      locale: 'en',
    } as const
    const exit = await execute(
      input(contentEntry),
      output,
      makeRepository({
        appendRevision: (request) =>
          Effect.sync(() => {
            appended.push(request)
            return {
              entry: {
                ...contentEntry,
                headRevisionId: 'revision-2',
                version: 3,
              },
              revision: revision(contentEntry, request.operationId ?? ''),
            }
          }),
      }),
      requests
    )

    expect(Exit.isSuccess(exit)).toBe(true)
    expect(appended).toHaveLength(1)
    expect(appended[0]?.source).toBe('ai_adjustment')
    expect(appended[0]?.operationId).toBe('run-1:refinement:request-1')
    expect(requests[0]?.prompt).toContain('Make the opening more direct.')
    expect(requests[0]?.prompt).toContain('Original letter.')
    if (Exit.isFailure(exit)) throw new Error('Expected refinement success.')
    expect(exit.value.value).toEqual(output)
  })

  test('rejects a CV that changes facts-backed identity metadata', async () => {
    const contentEntry = entry('cv')
    let appendCalls = 0
    const exit = await execute(
      input(contentEntry),
      {
        ...validCv,
        person: { ...validCv.person, name: 'Invented Candidate' },
      },
      makeRepository({
        appendRevision: () =>
          Effect.sync(() => {
            appendCalls += 1
            return {
              entry: contentEntry,
              revision: revision(contentEntry, 'unused'),
            }
          }),
      })
    )

    expect(Exit.isFailure(exit)).toBe(true)
    expect(appendCalls).toBe(0)
    if (Exit.isSuccess(exit)) throw new Error('Expected refinement failure.')
    const error = Cause.findErrorOption(exit.cause)
    expect(Option.isSome(error)).toBe(true)
    if (Option.isNone(error)) throw new Error('Expected a typed failure.')
    if (error.value._tag !== 'PreparationDataError') {
      throw new Error('Expected a preparation data failure.')
    }
    expect(error.value.operation).toBe('validate-refined-cv-provenance')
  })

  test('rejects a document that switches locale before appending it', async () => {
    const contentEntry = entry('cover_letter')
    let appendCalls = 0
    const exit = await execute(
      input(contentEntry),
      {
        $schema: 'cover-letter.v1',
        body: 'Lettre révisée.',
        locale: 'fr',
      },
      makeRepository({
        appendRevision: () =>
          Effect.sync(() => {
            appendCalls += 1
            return {
              entry: contentEntry,
              revision: revision(contentEntry, 'unused'),
            }
          }),
      })
    )

    expect(Exit.isFailure(exit)).toBe(true)
    expect(appendCalls).toBe(0)
    if (Exit.isSuccess(exit)) throw new Error('Expected refinement failure.')
    const error = Cause.findErrorOption(exit.cause)
    expect(Option.isSome(error)).toBe(true)
    if (Option.isNone(error)) throw new Error('Expected a typed failure.')
    if (error.value._tag !== 'PreparationDataError') {
      throw new Error('Expected a preparation data failure.')
    }
    expect(error.value.operation).toBe('validate-refined-locale')
  })
})
