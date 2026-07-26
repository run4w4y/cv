import {
  type CoverLetterDocument,
  CoverLetterDocumentSchema,
  coverLetterContractId,
} from '@cv/application-preparation-workflow/cover-letter'
import {
  type CvDocumentV1,
  CvDocumentV1Schema,
  cvDocumentV1ContractId,
} from '@cv/contracts/document'
import { makeTreeAtoms } from '@effect-state-tree/atom'
import {
  applyPatches,
  diffPatches,
  type GetAtPathFailure,
  getAtPath,
  isPathPrefix,
  type TreeInvariantError,
  type TreePatch,
  type TreePatchError,
  type TreePath,
} from '@effect-state-tree/core'
import {
  DraftAcceptedTag,
  type DraftError,
  DraftRefreshedTag,
  DraftResetTag,
  makeDraftScoped,
} from '@effect-state-tree/draft'
import {
  type HistoryRevisionConflict,
  makeHistoryScoped,
} from '@effect-state-tree/history'
import {
  defineTree,
  type TreeStoreShutdownError,
} from '@effect-state-tree/runtime'
import type {
  IndexedValidationIssue,
  ValidationReport,
} from '@effect-state-tree/validation'
import { Data, Effect, Option, Result, type Schema, type Scope } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'

export type DocumentStudioKind = 'cv' | 'cover_letter'
export type DocumentStudioDocument = CvDocumentV1 | CoverLetterDocument

export type DocumentStudioIdentity =
  | {
      readonly applicationId: string
      readonly kind: 'cv'
      readonly locale: string
    }
  | {
      readonly applicationId: string
      readonly kind: 'cover_letter'
      readonly locale: string
      readonly referenceCvRevisionId: string
    }

export interface DocumentStudioState {
  readonly canRedo: boolean
  readonly canUndo: boolean
  readonly changes: ReadonlyArray<TreePatch>
  readonly dirty: boolean
  readonly document: DocumentStudioDocument
  readonly original: DocumentStudioDocument
  readonly policyIssues: ReadonlyArray<DocumentPolicyIssue>
  readonly previewDocument: DocumentStudioDocument
  readonly previewIsStale: boolean
  readonly revision: number
  readonly validation: ValidationReport
  readonly valid: boolean
}

export type DocumentPolicyIssue = {
  readonly message: string
  readonly path: TreePath
  readonly severity: 'error' | 'warning'
}

export interface DocumentStudioIssue {
  readonly code?: string
  readonly message: string
  readonly path: TreePath
  readonly severity: 'error' | 'info' | 'warning'
}

export type DocumentPolicy = (
  document: DocumentStudioDocument
) => ReadonlyArray<DocumentPolicyIssue>

export class ProtectedDocumentPathError extends Data.TaggedError(
  'ProtectedDocumentPathError'
)<{
  readonly path: TreePath
}> {}

export class DocumentPolicyError extends Data.TaggedError(
  'DocumentPolicyError'
)<{
  readonly issues: ReadonlyArray<DocumentPolicyIssue>
}> {}

export class StaleDocumentOperationError extends Data.TaggedError(
  'StaleDocumentOperationError'
)<{
  readonly actualRevision: number
  readonly expectedRevision: number
}> {}

export class DocumentPersistenceError extends Data.TaggedError(
  'DocumentPersistenceError'
)<{
  readonly cause: unknown
  readonly message: string
}> {}

export type DocumentStudioMutationError =
  | DocumentPolicyError
  | DocumentPersistenceError
  | DraftError
  | GetAtPathFailure
  | HistoryRevisionConflict
  | ProtectedDocumentPathError
  | StaleDocumentOperationError
  | TreePatchError
  | TreeStoreShutdownError

export interface DocumentStudioSession {
  readonly identity: DocumentStudioIdentity
  readonly state: Atom.Atom<DocumentStudioState>
  readonly valueAt: (
    path: TreePath
  ) => Atom.Atom<Result.Result<unknown, GetAtPathFailure>>
  readonly issuesAt: (
    path: TreePath
  ) => Atom.Atom<ReadonlyArray<DocumentStudioIssue>>
  readonly issuesBelow: (
    path: TreePath
  ) => Atom.Atom<ReadonlyArray<DocumentStudioIssue>>
  readonly snapshot: () => DocumentStudioState
  readonly edit: (
    path: TreePath,
    value: unknown
  ) => Effect.Effect<void, DocumentStudioMutationError>
  readonly insert: (
    path: TreePath,
    index: number,
    value: unknown
  ) => Effect.Effect<void, DocumentStudioMutationError>
  readonly remove: (
    path: TreePath
  ) => Effect.Effect<void, DocumentStudioMutationError>
  readonly removeAt: (
    path: TreePath,
    index: number
  ) => Effect.Effect<void, DocumentStudioMutationError>
  readonly move: (
    path: TreePath,
    fromIndex: number,
    toIndex: number
  ) => Effect.Effect<void, DocumentStudioMutationError>
  readonly applyAssistantPatches: (
    patches: ReadonlyArray<TreePatch>,
    expectedRevision: number
  ) => Effect.Effect<void, DocumentStudioMutationError>
  readonly undo: Effect.Effect<void, DocumentStudioMutationError>
  readonly redo: Effect.Effect<void, DocumentStudioMutationError>
  readonly reset: Effect.Effect<void, DocumentStudioMutationError>
  readonly refresh: (
    document: DocumentStudioDocument
  ) => Effect.Effect<void, DocumentStudioMutationError>
  readonly submit: <E, R>(
    persist: (
      document: DocumentStudioDocument
    ) => Effect.Effect<DocumentStudioDocument, E, R>
  ) => Effect.Effect<void, DocumentStudioMutationError | E, R>
}

export const initialCvDocument = (locale: string): CvDocumentV1 => ({
  $schema: cvDocumentV1ContractId,
  locale,
  direction: 'ltr',
  person: {
    name: 'Your name',
    headline: 'Professional headline',
    summary: 'Write a concise professional summary.',
    contacts: [
      {
        kind: 'email',
        label: 'Email',
        value: 'you@example.com',
      },
    ],
  },
  experience: [],
  projects: [],
  skills: [],
  education: [],
  additionalSections: [],
})

export const initialCoverLetterDocument = (
  locale: string,
  referenceCvRevisionId: string
): CoverLetterDocument => ({
  $schema: coverLetterContractId,
  locale,
  referenceCvRevisionId,
  body: 'Write your tailored cover letter.',
})

export const initialDocumentForStudio = (
  identity: DocumentStudioIdentity
): DocumentStudioDocument =>
  identity.kind === 'cv'
    ? initialCvDocument(identity.locale)
    : initialCoverLetterDocument(
        identity.locale,
        identity.referenceCvRevisionId
      )

const isProtectedPath = (path: TreePath): boolean => {
  if (path.length === 0) return true
  const first = path[0]
  if (
    first === '$schema' ||
    first === 'locale' ||
    first === 'direction' ||
    first === 'referenceCvRevisionId'
  ) {
    return true
  }
  return path.at(-1) === 'id'
}

const assertEditablePath = (
  path: TreePath
): Effect.Effect<void, ProtectedDocumentPathError> =>
  isProtectedPath(path)
    ? Effect.fail(new ProtectedDocumentPathError({ path }))
    : Effect.void

const assistantPathIsProtected = (path: TreePath): boolean => {
  const protectedPrefixes: ReadonlyArray<TreePath> = [
    ['$schema'],
    ['locale'],
    ['direction'],
    ['referenceCvRevisionId'],
    ['person', 'name'],
    ['person', 'contacts'],
  ]
  return (
    path.at(-1) === 'id' ||
    protectedPrefixes.some(
      (prefix) => isPathPrefix(prefix, path) || isPathPrefix(path, prefix)
    )
  )
}

const nestedEntityIds = (value: unknown): ReadonlySet<string> => {
  const ids = new Set<string>()
  const visit = (current: unknown): void => {
    if (Array.isArray(current)) {
      for (const item of current) visit(item)
      return
    }
    if (current === null || typeof current !== 'object') return
    const id = Reflect.get(current, 'id')
    if (Object.hasOwn(current, 'id') && typeof id === 'string') {
      ids.add(id)
    }
    for (const child of Object.values(current)) visit(child)
  }
  visit(value)
  return ids
}

const replacementPreservesEntityIds = (
  before: unknown,
  replacement: unknown
): boolean => {
  const replacementIds = nestedEntityIds(replacement)
  return [...nestedEntityIds(before)].every((id) => replacementIds.has(id))
}

const effectFromResult = <A, E>(
  result: Result.Result<A, E>
): Effect.Effect<A, E> =>
  Result.isSuccess(result)
    ? Effect.succeed(result.success)
    : Effect.fail(result.failure)

const samePath = (left: TreePath, right: TreePath): boolean =>
  left.length === right.length &&
  left.every((segment, index) => segment === right[index])

const issueMatches = (
  issuePath: TreePath,
  path: TreePath,
  below: boolean
): boolean =>
  below ? isPathPrefix(path, issuePath) : samePath(issuePath, path)

const normalizeValidationIssue = (
  issue: IndexedValidationIssue
): DocumentStudioIssue => ({
  message: issue.message,
  path: issue.path,
  severity: 'error',
})

const normalizePolicyIssue = (
  issue: DocumentPolicyIssue
): DocumentStudioIssue => ({
  code: 'document.policy',
  message: issue.message,
  path: issue.path,
  severity: issue.severity,
})

const hasBlockingPolicyIssues = (
  issues: ReadonlyArray<DocumentPolicyIssue>
): boolean => issues.some(({ severity }) => severity === 'error')

const issueKey = (issue: DocumentStudioIssue): string =>
  JSON.stringify([
    issue.code ?? null,
    issue.message,
    issue.path,
    issue.severity,
  ])

const sameIssues = (
  left: ReadonlyArray<DocumentStudioIssue>,
  right: ReadonlyArray<DocumentStudioIssue>
): boolean =>
  left.length === right.length &&
  left.every((issue, index) => issueKey(issue) === issueKey(right[index]))

const makeIssueAtom = (
  path: TreePath,
  below: boolean,
  validation: {
    readonly getReport: () => ValidationReport
    readonly subscribe: (listener: () => void) => () => void
  },
  currentPolicyIssues: () => ReadonlyArray<DocumentPolicyIssue>,
  subscribeDocument: (listener: () => void) => () => void
): Atom.Atom<ReadonlyArray<DocumentStudioIssue>> =>
  Atom.readable((context) => {
    const read = (): ReadonlyArray<DocumentStudioIssue> => [
      ...validation
        .getReport()
        .issues.filter((issue) => issueMatches(issue.path, path, below))
        .map(normalizeValidationIssue),
      ...currentPolicyIssues()
        .filter((issue) => issueMatches(issue.path, path, below))
        .map(normalizePolicyIssue),
    ]
    let previous = read()
    const notifyIfChanged = () => {
      const next = read()
      if (sameIssues(previous, next)) return
      previous = next
      context.setSelf(next)
    }
    context.addFinalizer(validation.subscribe(notifyIfChanged))
    context.addFinalizer(subscribeDocument(notifyIfChanged))
    return previous
  })

const makeTypedSession = <
  const Id extends string,
  D extends DocumentStudioDocument,
  S extends Schema.ConstraintCodec<D, D, never, unknown>,
>(
  identity: DocumentStudioIdentity,
  treeId: Id,
  schema: S,
  initial: unknown,
  narrowDocument: (
    document: DocumentStudioDocument
  ) => Result.Result<D, DocumentPersistenceError>,
  policy?: DocumentPolicy
): Effect.Effect<DocumentStudioSession, TreeInvariantError, Scope.Scope> =>
  Effect.gen(function* () {
    const draft = yield* makeDraftScoped(schema, initial)
    const definition = defineTree(treeId, draft.data.spec)
    const history = yield* makeHistoryScoped(draft.data, {
      limit: 150,
      baselineTags: [DraftAcceptedTag, DraftRefreshedTag, DraftResetTag],
    })
    const validation = draft.validation
    const policyIssues = (document: D) => policy?.(document) ?? []
    const previewDocument = (): D =>
      Option.match(draft.getValidated(), {
        onNone: draft.getSaved,
        onSome: (checkpoint) => checkpoint.snapshot,
      })

    const tree = makeTreeAtoms(definition, draft.data)
    const draftAtom = tree.snapshot
    const draftStateAtom = tree.view(draft)
    const historyAtom = tree.view(history)
    const validationAtom = tree.view(validation)

    const makeState = (): DocumentStudioState => {
      const document = draft.data.getSnapshot()
      const saved = draft.getSaved()
      const changes = diffPatches(saved, document)
      const currentValidation = validation.getReport()
      const currentPolicyIssues = policyIssues(document)
      const schemaValid = currentValidation.status === 'valid'
      return {
        canRedo: history.canRedo(),
        canUndo: history.canUndo(),
        changes: Result.isSuccess(changes) ? changes.success : [],
        dirty: draft.isDirty(),
        document,
        original: saved,
        policyIssues: currentPolicyIssues,
        previewDocument: previewDocument(),
        previewIsStale: !schemaValid,
        revision: draft.data.getRevision(),
        validation: currentValidation,
        valid: schemaValid && !hasBlockingPolicyIssues(currentPolicyIssues),
      }
    }

    const state = Atom.make((get): DocumentStudioState => {
      const document = get(draftAtom)
      const draftState = get(draftStateAtom)
      const currentHistory = get(historyAtom)
      const currentValidation = get(validationAtom)
      const changes = diffPatches(draftState.saved, document)
      const currentPolicyIssues = policyIssues(document)
      const schemaValid = currentValidation.status === 'valid'
      const validated = draft.getValidated()
      return {
        canRedo: currentHistory.redo.length > 0,
        canUndo: currentHistory.undo.length > 0,
        changes: Result.isSuccess(changes) ? changes.success : [],
        dirty: draftState.dirty,
        document,
        original: draftState.saved,
        policyIssues: currentPolicyIssues,
        previewDocument: Option.match(validated, {
          onNone: () => draftState.saved,
          onSome: (checkpoint) => checkpoint.snapshot,
        }),
        previewIsStale: !schemaValid,
        revision: draft.data.getRevision(),
        validation: currentValidation,
        valid: schemaValid && !hasBlockingPolicyIssues(currentPolicyIssues),
      }
    })

    const pathRegistry = new Map<string, TreePath>()
    const registerPath = (path: TreePath): string => {
      const key = JSON.stringify(path)
      if (!pathRegistry.has(key)) pathRegistry.set(key, [...path])
      return key
    }
    const registeredPath = (key: string): TreePath => {
      const path = pathRegistry.get(key)
      if (path === undefined) {
        throw new Error(`Document Studio path was not registered: ${key}`)
      }
      return path
    }
    const valueAtomFamily = Atom.family((key: string) => {
      const path = registeredPath(key)
      return tree.select((document) => getAtPath(document, path), {
        paths: [path],
      })
    })
    const issuesAtFamily = Atom.family((key: string) =>
      makeIssueAtom(
        registeredPath(key),
        false,
        validation,
        () => policyIssues(draft.data.getSnapshot()),
        (listener) => draft.data.subscribe(() => listener())
      )
    )
    const issuesBelowFamily = Atom.family((key: string) =>
      makeIssueAtom(
        registeredPath(key),
        true,
        validation,
        () => policyIssues(draft.data.getSnapshot()),
        (listener) => draft.data.subscribe(() => listener())
      )
    )

    const apply = Effect.fn('DocumentStudio.apply')(function* (
      patches: ReadonlyArray<TreePatch>,
      label: string
    ) {
      yield* draft.data.apply(
        {
          patches: {
            forward: patches,
            inverse: [],
          },
        },
        { label }
      )
    })

    const session: DocumentStudioSession = {
      identity,
      state,
      valueAt: (path) => valueAtomFamily(registerPath(path)),
      issuesAt: (path) => issuesAtFamily(registerPath(path)),
      issuesBelow: (path) => issuesBelowFamily(registerPath(path)),
      snapshot: makeState,
      edit: Effect.fn('DocumentStudio.edit')(function* (path, value) {
        yield* assertEditablePath(path)
        const current = getAtPath(draft.data.getSnapshot(), path)
        if (value === undefined) {
          if (Result.isSuccess(current)) {
            yield* apply(
              [{ op: 'remove', path }],
              'Clear optional document value'
            )
          }
          return
        }
        yield* apply(
          [
            Result.isSuccess(current)
              ? { op: 'replace', path, value }
              : { op: 'add', path, value },
          ],
          'Edit document'
        )
      }),
      remove: Effect.fn('DocumentStudio.remove')(function* (path) {
        yield* assertEditablePath(path)
        yield* apply([{ op: 'remove', path }], 'Remove document value')
      }),
      insert: Effect.fn('DocumentStudio.insert')(
        function* (path, index, value) {
          yield* assertEditablePath(path)
          yield* apply(
            [{ op: 'add', path: [...path, index], value }],
            'Add document item'
          )
        }
      ),
      removeAt: Effect.fn('DocumentStudio.removeAt')(function* (path, index) {
        yield* assertEditablePath(path)
        yield* apply(
          [{ op: 'remove', path: [...path, index] }],
          'Remove document item'
        )
      }),
      move: Effect.fn('DocumentStudio.move')(
        function* (path, fromIndex, toIndex) {
          yield* assertEditablePath(path)
          if (fromIndex === toIndex) return
          const current = yield* effectFromResult(
            getAtPath(draft.data.getSnapshot(), [...path, fromIndex])
          )
          yield* apply(
            [
              { op: 'remove', path: [...path, fromIndex] },
              { op: 'add', path: [...path, toIndex], value: current },
            ],
            'Move document item'
          )
        }
      ),
      applyAssistantPatches: Effect.fn('DocumentStudio.applyAssistantPatches')(
        function* (patches, expectedRevision) {
          const actualRevision = draft.data.getRevision()
          if (actualRevision !== expectedRevision) {
            return yield* Effect.fail(
              new StaleDocumentOperationError({
                actualRevision,
                expectedRevision,
              })
            )
          }
          let proposed: unknown = draft.data.getSnapshot()
          for (const patch of patches) {
            if (assistantPathIsProtected(patch.path)) {
              return yield* Effect.fail(
                new ProtectedDocumentPathError({ path: patch.path })
              )
            }
            if (patch.op === 'replace') {
              const current = getAtPath(proposed, patch.path)
              if (
                Result.isSuccess(current) &&
                !replacementPreservesEntityIds(current.success, patch.value)
              ) {
                return yield* Effect.fail(
                  new ProtectedDocumentPathError({ path: patch.path })
                )
              }
            }
            const next = yield* effectFromResult(
              applyPatches(proposed, [patch])
            )
            proposed = next.snapshot
          }
          yield* apply(patches, 'Apply Codex changes')
          return yield* Effect.void
        }
      ),
      undo: history.undo.pipe(Effect.asVoid),
      redo: history.redo.pipe(Effect.asVoid),
      reset: draft.reset.pipe(Effect.asVoid),
      refresh: (document) =>
        Effect.flatMap(effectFromResult(narrowDocument(document)), (value) =>
          draft.refresh(value)
        ).pipe(Effect.asVoid),
      submit: (persist) =>
        Effect.gen(function* () {
          const issues = policyIssues(draft.data.getSnapshot())
          const blockingIssues = issues.filter(
            ({ severity }) => severity === 'error'
          )
          if (blockingIssues.length > 0) {
            return yield* new DocumentPolicyError({
              issues: blockingIssues,
            })
          }
          const result = yield* draft.submit(({ submitted }) =>
            Effect.flatMap(persist(submitted), (document) =>
              effectFromResult(narrowDocument(document))
            )
          )
          if (result._tag === 'Accepted') history.clear()
        }),
    }

    return session
  })

const wrongDocumentKind = (
  expected: DocumentStudioKind,
  document: DocumentStudioDocument
): DocumentPersistenceError =>
  new DocumentPersistenceError({
    cause: document,
    message: `Expected a ${expected} document, received ${document.$schema}.`,
  })

const narrowCvDocument = (
  document: DocumentStudioDocument
): Result.Result<CvDocumentV1, DocumentPersistenceError> =>
  document.$schema === cvDocumentV1ContractId
    ? Result.succeed(document)
    : Result.fail(wrongDocumentKind('cv', document))

const narrowCoverLetterDocument = (
  document: DocumentStudioDocument
): Result.Result<CoverLetterDocument, DocumentPersistenceError> =>
  document.$schema === coverLetterContractId
    ? Result.succeed(document)
    : Result.fail(wrongDocumentKind('cover_letter', document))

export const makeDocumentStudioSession = (
  identity: DocumentStudioIdentity,
  document: DocumentStudioDocument = initialDocumentForStudio(identity),
  policy?: DocumentPolicy
): Effect.Effect<DocumentStudioSession, TreeInvariantError, Scope.Scope> =>
  identity.kind === 'cv'
    ? makeTypedSession(
        identity,
        '@cv/application-registry/CvDocumentStudio',
        CvDocumentV1Schema,
        document,
        narrowCvDocument,
        policy
      )
    : makeTypedSession(
        identity,
        '@cv/application-registry/CoverLetterDocumentStudio',
        CoverLetterDocumentSchema,
        document,
        narrowCoverLetterDocument,
        policy
      )
