import { describe, expect, it } from 'bun:test'
import { cvProvenanceIssues } from '@cv/application-preparation-workflow'
import type { CvDocumentV1 } from '@cv/contracts/document'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import { Cause, Deferred, Effect, Exit, Fiber, Option } from 'effect'

import {
  DocumentPolicyError,
  type DocumentStudioDocument,
  initialCvDocument,
  makeDocumentStudioSession,
  ProtectedDocumentPathError,
  StaleDocumentOperationError,
} from './session'

const identity = {
  applicationId: 'application-1',
  kind: 'cover_letter',
  locale: 'en',
  referenceCvRevisionId: 'cv-revision-1',
} as const

const expectError = <E>(
  exit: Exit.Exit<unknown, E>,
  errorClass: abstract new (...args: never[]) => E
): E => {
  expect(Exit.isFailure(exit)).toBe(true)
  if (Exit.isSuccess(exit)) {
    throw new Error('Expected the Effect to fail.')
  }
  const error = Cause.findErrorOption(exit.cause)
  expect(Option.isSome(error)).toBe(true)
  if (Option.isNone(error)) {
    throw new Error('Expected a typed Effect failure.')
  }
  expect(error.value).toBeInstanceOf(errorClass)
  return error.value
}

describe('Document Studio state-tree session', () => {
  it('keeps invalid intermediate edits and supports undo and redo', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const session = yield* makeDocumentStudioSession(identity)

          yield* session.edit(['body'], '')
          expect(session.snapshot().dirty).toBe(true)
          expect(session.snapshot().valid).toBe(false)
          expect(session.snapshot().validation.issues[0]?.path).toEqual([
            'body',
          ])
          expect(session.snapshot().validation.issues.length).toBeGreaterThan(0)
          expect(session.snapshot().previewDocument).toMatchObject({
            body: 'Write your tailored cover letter.',
          })
          expect(session.snapshot().previewIsStale).toBe(true)

          yield* session.undo
          expect(session.snapshot().document).toMatchObject({
            body: 'Write your tailored cover letter.',
          })
          expect(session.snapshot().dirty).toBe(false)
          expect(session.snapshot().canRedo).toBe(true)

          yield* session.redo
          expect(session.snapshot().document).toMatchObject({ body: '' })
        })
      )
    )
  })

  it('accepts an authoritative save while preserving newer edits', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const session = yield* makeDocumentStudioSession(identity)
          yield* session.edit(['body'], 'Submitted body')
          const submitted = yield* Deferred.make<DocumentStudioDocument>()
          const release = yield* Deferred.make<DocumentStudioDocument>()

          const saveFiber = yield* session
            .submit((document) =>
              Deferred.succeed(submitted, document).pipe(
                Effect.andThen(Deferred.await(release))
              )
            )
            .pipe(Effect.forkScoped)
          const submittedDocument = yield* Deferred.await(submitted)

          yield* session.edit(['body'], 'Newer local body')
          yield* Deferred.succeed(release, submittedDocument)
          yield* Fiber.join(saveFiber)

          expect(session.snapshot().original).toMatchObject({
            body: 'Submitted body',
          })
          expect(session.snapshot().document).toMatchObject({
            body: 'Newer local body',
          })
          expect(session.snapshot().dirty).toBe(true)
        })
      )
    )
  })

  it('applies one ordered assistant batch and rejects stale or protected edits', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const session = yield* makeDocumentStudioSession(identity)
          const revision = session.snapshot().revision

          yield* session.applyAssistantPatches(
            [
              {
                op: 'replace',
                path: ['body'],
                value: 'First assistant value',
              },
              {
                op: 'replace',
                path: ['body'],
                value: 'Final assistant value',
              },
            ],
            revision
          )
          expect(session.snapshot().document).toMatchObject({
            body: 'Final assistant value',
          })
          expect(session.snapshot().canUndo).toBe(true)

          const stale = yield* Effect.exit(
            session.applyAssistantPatches(
              [
                {
                  op: 'replace',
                  path: ['body'],
                  value: 'Stale revision',
                },
              ],
              revision
            )
          )
          expectError(stale, StaleDocumentOperationError)

          const protectedEdit = yield* Effect.exit(
            session.edit(['$schema'], 'anything')
          )
          expectError(protectedEdit, ProtectedDocumentPathError)
        })
      )
    )
  })

  it('rejects assistant replacements that mutate nested stable entity IDs', async () => {
    const document = {
      ...initialCvDocument('en'),
      experience: [
        {
          company: 'Example',
          highlights: ['Built reliable systems.'],
          id: 'experience-1',
          period: '2024–present',
          role: 'Engineer',
          technologies: ['TypeScript'],
        },
      ],
    }

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const session = yield* makeDocumentStudioSession(
            {
              applicationId: 'application-1',
              kind: 'cv',
              locale: 'en',
            },
            document
          )
          const attemptedReplacement = yield* Effect.exit(
            session.applyAssistantPatches(
              [
                {
                  op: 'replace',
                  path: ['experience', 0],
                  value: {
                    ...document.experience[0],
                    id: 'invented-id',
                  },
                },
              ],
              session.snapshot().revision
            )
          )

          expectError(attemptedReplacement, ProtectedDocumentPathError)
          expect(
            (session.snapshot().document as typeof document).experience[0]?.id
          ).toBe('experience-1')
        })
      )
    )
  })

  it('keeps policy-invalid edits but blocks persistence and protects assistant ancestor replacements', async () => {
    const document = initialCvDocument('en')

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const session = yield* makeDocumentStudioSession(
            {
              applicationId: 'application-1',
              kind: 'cv',
              locale: 'en',
            },
            document,
            (candidate) =>
              (candidate as typeof document).person.name ===
              document.person.name
                ? []
                : [
                    {
                      message: 'Name must come from reviewed identity facts.',
                      path: ['person', 'name'],
                      severity: 'error' as const,
                    },
                  ]
          )

          yield* session.edit(['person', 'name'], 'Invented person')
          expect(session.snapshot().document).toMatchObject({
            person: { name: 'Invented person' },
          })
          expect(session.snapshot().valid).toBe(false)
          expect(session.snapshot().policyIssues).toEqual([
            {
              message: 'Name must come from reviewed identity facts.',
              path: ['person', 'name'],
              severity: 'error',
            },
          ])
          expect(session.snapshot().previewDocument).toMatchObject({
            person: { name: 'Invented person' },
          })
          expect(session.snapshot().previewIsStale).toBe(false)
          expectError(
            yield* Effect.exit(
              session.submit((candidate) => Effect.succeed(candidate))
            ),
            DocumentPolicyError
          )

          yield* session.reset
          expectError(
            yield* Effect.exit(
              session.applyAssistantPatches(
                [
                  {
                    op: 'replace',
                    path: ['person'],
                    value: {
                      ...document.person,
                      name: 'Invented person',
                    },
                  },
                ],
                session.snapshot().revision
              )
            ),
            ProtectedDocumentPathError
          )
          expectError(
            yield* Effect.exit(
              session.applyAssistantPatches(
                [{ op: 'replace', path: [], value: document }],
                session.snapshot().revision
              )
            ),
            ProtectedDocumentPathError
          )
        })
      )
    )
  })

  it('keeps provenance-invalid project-link edits but blocks persistence', async () => {
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
          name: 'Your name',
        },
        {
          items: [
            {
              id: 'contact.email',
              kind: 'email',
              value: 'you@example.com',
              visibility: 'public',
            },
          ],
          kind: 'contact',
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
    const document: CvDocumentV1 = {
      ...initialCvDocument('en'),
      projects: [
        {
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
        },
      ],
    }

    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const session = yield* makeDocumentStudioSession(
            {
              applicationId: 'application-1',
              kind: 'cv',
              locale: 'en',
            },
            document,
            (candidate) =>
              cvProvenanceIssues(factsCatalogue, candidate as CvDocumentV1).map(
                (issue) => ({ ...issue, severity: 'error' as const })
              )
          )

          yield* session.edit(
            ['projects', 0, 'links', 0, 'label'],
            'Invented label'
          )
          yield* session.applyAssistantPatches(
            [
              {
                op: 'replace',
                path: ['projects', 0, 'links', 0, 'value'],
                value: 'Invented value',
              },
            ],
            session.snapshot().revision
          )

          expect(session.snapshot().valid).toBe(false)
          expect(session.snapshot().policyIssues.length).toBeGreaterThan(0)
          expectError(
            yield* Effect.exit(
              session.submit((candidate) => Effect.succeed(candidate))
            ),
            DocumentPolicyError
          )
          expect(
            (session.snapshot().document as CvDocumentV1).projects[0]?.links[0]
          ).toMatchObject({
            label: 'Invented label',
            value: 'Invented value',
          })
        })
      )
    )
  })
})
