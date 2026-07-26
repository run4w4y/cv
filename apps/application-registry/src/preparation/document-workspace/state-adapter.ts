import { documentChanges } from './document-utils'
import type {
  DocumentChange,
  DocumentMutationFailure,
  DocumentMutationHandlers,
  DocumentMutationStatusListener,
  DocumentPath,
  DocumentValidationIssue,
} from './types'

type StudioSessionActions = {
  readonly edit: (path: DocumentPath, value: unknown) => Promise<void>
  readonly insert: (
    path: DocumentPath,
    index: number,
    value: unknown
  ) => Promise<void>
  readonly move: (
    path: DocumentPath,
    fromIndex: number,
    toIndex: number
  ) => Promise<void>
  readonly remove: (path: DocumentPath) => Promise<void>
  readonly removeAt: (path: DocumentPath, index: number) => Promise<void>
}

type StudioValidationIssue = {
  readonly message: string
  readonly path: ReadonlyArray<PropertyKey>
  readonly severity?: string
}

type MutationDescriptor = Pick<DocumentMutationFailure, 'operation' | 'path'>

const mutationTarget = (path: DocumentPath): string =>
  path.length === 0
    ? 'the document'
    : path
        .map((segment) =>
          typeof segment === 'number' ? `item ${segment + 1}` : segment
        )
        .join(' › ')

const failureDetail = (cause: unknown): string => {
  if (cause instanceof Error && cause.message.trim().length > 0) {
    return cause.message
  }
  if (typeof cause === 'string' && cause.trim().length > 0) return cause
  return 'The document state rejected the change.'
}

const mutationFailure = (
  descriptor: MutationDescriptor,
  cause: unknown
): DocumentMutationFailure => {
  const action =
    descriptor.operation === 'add'
      ? 'add an item to'
      : descriptor.operation === 'edit'
        ? 'edit'
        : descriptor.operation === 'move'
          ? 'reorder'
          : 'remove an item from'
  return {
    ...descriptor,
    cause,
    message: `Could not ${action} ${mutationTarget(descriptor.path)}. ${failureDetail(cause)}`,
  }
}

export const documentMutationHandlers = (
  session: StudioSessionActions,
  onStatusChange: DocumentMutationStatusListener
): DocumentMutationHandlers => {
  let latestOperation = 0

  const runMutation = (
    descriptor: MutationDescriptor,
    operation: () => Promise<void>
  ): void => {
    const operationId = ++latestOperation
    const complete = (failure: DocumentMutationFailure | null): void => {
      if (operationId === latestOperation) onStatusChange(failure)
    }

    try {
      void operation().then(
        () => complete(null),
        (cause) => complete(mutationFailure(descriptor, cause))
      )
    } catch (cause) {
      complete(mutationFailure(descriptor, cause))
    }
  }

  return {
    onAdd: (path, value, index = 0) => {
      runMutation({ operation: 'add', path: [...path, index] }, () =>
        session.insert(path, index, value)
      )
    },
    onEdit: (path, value) => {
      runMutation({ operation: 'edit', path }, () =>
        value === undefined ? session.remove(path) : session.edit(path, value)
      )
    },
    onMove: (path, fromIndex, toIndex) => {
      runMutation({ operation: 'move', path }, () =>
        session.move(path, fromIndex, toIndex)
      )
    },
    onRemove: (path, index) => {
      runMutation({ operation: 'remove', path: [...path, index] }, () =>
        session.removeAt(path, index)
      )
    },
  }
}

export const documentValidationIssues = (
  issues: ReadonlyArray<StudioValidationIssue>
): ReadonlyArray<DocumentValidationIssue> =>
  issues
    .filter(
      (issue) => issue.severity === undefined || issue.severity === 'error'
    )
    .map((issue) => ({
      message: issue.message,
      path: issue.path.map((segment) =>
        typeof segment === 'number' ? segment : String(segment)
      ),
    }))

export const documentChangeSummary = (
  original: unknown,
  document: unknown
): ReadonlyArray<DocumentChange> => documentChanges(original, document)
