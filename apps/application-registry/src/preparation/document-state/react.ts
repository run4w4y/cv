import * as ScopedAtom from '@effect/atom-react/ScopedAtom'
import type {
  GetAtPathFailure,
  TreeInvariantError,
  TreePatch,
  TreePath,
} from '@effect-state-tree/core'
import { Effect } from 'effect'
import type * as Result from 'effect/Result'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'
import * as React from 'react'

import {
  DocumentPersistenceError,
  type DocumentPolicy,
  type DocumentStudioDocument,
  type DocumentStudioIdentity,
  type DocumentStudioIssue,
  type DocumentStudioMutationError,
  type DocumentStudioSession,
  type DocumentStudioState,
  makeDocumentStudioSession,
} from './session'

export type DocumentStudioMode = 'changes' | 'edit' | 'preview'

export interface DocumentStudioScopeInput {
  readonly authoritativeKey: string
  readonly defaultMode?: DocumentStudioMode
  readonly document: DocumentStudioDocument
  readonly identity: DocumentStudioIdentity
  readonly policy?: DocumentPolicy
  readonly policyKey?: string
}

export interface DocumentEditInput {
  readonly path: TreePath
  readonly value: unknown
}

export interface DocumentInsertInput {
  readonly index: number
  readonly path: TreePath
  readonly value: unknown
}

export interface DocumentRemoveAtInput {
  readonly index: number
  readonly path: TreePath
}

export interface DocumentMoveInput {
  readonly fromIndex: number
  readonly path: TreePath
  readonly toIndex: number
}

export interface DocumentAssistantPatchInput {
  readonly expectedRevision: number
  readonly patches: ReadonlyArray<TreePatch>
}

export interface DocumentSubmitInput {
  readonly persist: (
    document: DocumentStudioDocument
  ) => Promise<DocumentStudioDocument>
}

export type DocumentStudioActionError =
  | DocumentPersistenceError
  | DocumentStudioMutationError
  | TreeInvariantError

export interface DocumentStudioAtoms
  extends Atom.Atom<
    AsyncResult.AsyncResult<DocumentStudioState, TreeInvariantError>
  > {
  readonly key: string
  readonly kind: DocumentStudioIdentity['kind']
  readonly session: Atom.Atom<
    AsyncResult.AsyncResult<DocumentStudioSession, TreeInvariantError>
  >
  readonly mode: Atom.Writable<DocumentStudioMode>
  readonly valueAt: (
    path: TreePath
  ) => Atom.Atom<
    AsyncResult.AsyncResult<
      Result.Result<unknown, GetAtPathFailure>,
      TreeInvariantError
    >
  >
  readonly issuesAt: (
    path: TreePath
  ) => Atom.Atom<
    AsyncResult.AsyncResult<
      ReadonlyArray<DocumentStudioIssue>,
      TreeInvariantError
    >
  >
  readonly issuesBelow: (
    path: TreePath
  ) => Atom.Atom<
    AsyncResult.AsyncResult<
      ReadonlyArray<DocumentStudioIssue>,
      TreeInvariantError
    >
  >
  readonly edit: Atom.AtomResultFn<
    DocumentEditInput,
    void,
    DocumentStudioActionError
  >
  readonly insert: Atom.AtomResultFn<
    DocumentInsertInput,
    void,
    DocumentStudioActionError
  >
  readonly remove: Atom.AtomResultFn<TreePath, void, DocumentStudioActionError>
  readonly removeAt: Atom.AtomResultFn<
    DocumentRemoveAtInput,
    void,
    DocumentStudioActionError
  >
  readonly move: Atom.AtomResultFn<
    DocumentMoveInput,
    void,
    DocumentStudioActionError
  >
  readonly applyAssistantPatches: Atom.AtomResultFn<
    DocumentAssistantPatchInput,
    void,
    DocumentStudioActionError
  >
  readonly undo: Atom.AtomResultFn<void, void, DocumentStudioActionError>
  readonly redo: Atom.AtomResultFn<void, void, DocumentStudioActionError>
  readonly reset: Atom.AtomResultFn<void, void, DocumentStudioActionError>
  readonly refreshDocument: Atom.AtomResultFn<
    DocumentStudioDocument,
    void,
    DocumentStudioActionError
  >
  readonly submit: Atom.AtomResultFn<
    DocumentSubmitInput,
    void,
    DocumentStudioActionError
  >
}

export const documentStudioScopeKey = (
  input: DocumentStudioScopeInput
): string =>
  JSON.stringify([
    input.identity.applicationId,
    input.identity.kind,
    input.identity.locale,
    input.identity.kind === 'cover_letter'
      ? input.identity.referenceCvRevisionId
      : null,
    input.authoritativeKey,
    input.policyKey ?? 'default-policy',
  ] as const)

const makeDocumentStudioAtoms = (
  input: DocumentStudioScopeInput
): DocumentStudioAtoms => {
  const key = documentStudioScopeKey(input)
  const session = Atom.make(
    makeDocumentStudioSession(input.identity, input.document, input.policy)
  )
  const mode = Atom.make<DocumentStudioMode>(input.defaultMode ?? 'edit')

  const withSession =
    <A, E>(
      operation: (session: DocumentStudioSession) => Effect.Effect<A, E>
    ): ((get: Atom.FnContext) => Effect.Effect<A, E | TreeInvariantError>) =>
    (get) =>
      get
        .result(session)
        .pipe(Effect.flatMap((activeSession) => operation(activeSession)))

  const edit = Atom.fn<DocumentEditInput>()((command, get) =>
    withSession((activeSession) =>
      activeSession.edit(command.path, command.value)
    )(get)
  )
  const insert = Atom.fn<DocumentInsertInput>()((command, get) =>
    withSession((activeSession) =>
      activeSession.insert(command.path, command.index, command.value)
    )(get)
  )
  const remove = Atom.fn<TreePath>()((path, get) =>
    withSession((activeSession) => activeSession.remove(path))(get)
  )
  const removeAt = Atom.fn<DocumentRemoveAtInput>()((command, get) =>
    withSession((activeSession) =>
      activeSession.removeAt(command.path, command.index)
    )(get)
  )
  const move = Atom.fn<DocumentMoveInput>()((command, get) =>
    withSession((activeSession) =>
      activeSession.move(command.path, command.fromIndex, command.toIndex)
    )(get)
  )
  const applyAssistantPatches = Atom.fn<DocumentAssistantPatchInput>()(
    (command, get) =>
      withSession((activeSession) =>
        activeSession.applyAssistantPatches(
          command.patches,
          command.expectedRevision
        )
      )(get)
  )
  const undo = Atom.fn<void>()((_input, get) =>
    withSession((activeSession) => activeSession.undo)(get)
  )
  const redo = Atom.fn<void>()((_input, get) =>
    withSession((activeSession) => activeSession.redo)(get)
  )
  const reset = Atom.fn<void>()((_input, get) =>
    withSession((activeSession) => activeSession.reset)(get)
  )
  const refreshDocument = Atom.fn<DocumentStudioDocument>()((document, get) =>
    withSession((activeSession) => activeSession.refresh(document))(get)
  )
  const submit = Atom.fn<DocumentSubmitInput>()((command, get) =>
    withSession((activeSession) =>
      activeSession.submit((document) =>
        Effect.tryPromise({
          try: () => command.persist(document),
          catch: (cause) =>
            new DocumentPersistenceError({
              cause,
              message:
                cause instanceof Error
                  ? cause.message
                  : 'The document could not be saved.',
            }),
        })
      )
    )(get)
  )

  const pathRegistry = new Map<string, TreePath>()
  const registerPath = (path: TreePath): string => {
    const pathKey = JSON.stringify(path)
    if (!pathRegistry.has(pathKey)) pathRegistry.set(pathKey, [...path])
    return pathKey
  }
  const registeredPath = (pathKey: string): TreePath => {
    const path = pathRegistry.get(pathKey)
    if (path === undefined) {
      throw new Error(
        `Document Studio scoped path was not registered: ${pathKey}`
      )
    }
    return path
  }
  const valueAtFamily = Atom.family((pathKey: string) =>
    Atom.make((get) => {
      const result = get(session)
      return result.pipe(
        AsyncResult.map((activeSession) =>
          get(activeSession.valueAt(registeredPath(pathKey)))
        )
      )
    })
  )
  const issuesAtFamily = Atom.family((pathKey: string) =>
    Atom.make((get) => {
      const result = get(session)
      return result.pipe(
        AsyncResult.map((activeSession) =>
          get(activeSession.issuesAt(registeredPath(pathKey)))
        )
      )
    })
  )
  const issuesBelowFamily = Atom.family((pathKey: string) =>
    Atom.make((get) => {
      const result = get(session)
      return result.pipe(
        AsyncResult.map((activeSession) =>
          get(activeSession.issuesBelow(registeredPath(pathKey)))
        )
      )
    })
  )

  const state = Atom.make((get) => {
    const result = get(session)
    return result.pipe(
      AsyncResult.map((activeSession) => get(activeSession.state))
    )
  })

  return Object.assign(state, {
    applyAssistantPatches,
    edit,
    insert,
    issuesAt: (path: TreePath) => issuesAtFamily(registerPath(path)),
    issuesBelow: (path: TreePath) => issuesBelowFamily(registerPath(path)),
    key,
    kind: input.identity.kind,
    mode,
    move,
    redo,
    refreshDocument,
    remove,
    removeAt,
    reset,
    session,
    submit,
    undo,
    valueAt: (path: TreePath) => valueAtFamily(registerPath(path)),
  })
}

const ScopedDocumentStudio = ScopedAtom.make(makeDocumentStudioAtoms)

export interface DocumentStudioProviderProps {
  readonly children?: React.ReactNode
  readonly value: DocumentStudioScopeInput
}

export const DocumentStudioProvider = ({
  children,
  value,
}: DocumentStudioProviderProps): React.ReactElement =>
  React.createElement(
    ScopedDocumentStudio.Provider,
    {
      key: documentStudioScopeKey(value),
      value,
    },
    children
  )

export const useDocumentStudioAtoms = (): DocumentStudioAtoms =>
  ScopedDocumentStudio.use()
