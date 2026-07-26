import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'

import { makeDocumentStudioSession } from '../document-state'
import { documentMutationHandlers } from './state-adapter'
import type {
  DocumentMutationFailure,
  DocumentMutationStatusListener,
} from './types'

const unusedOperation = async (): Promise<void> => undefined

describe('documentMutationHandlers', () => {
  test('reports an actionable failure instead of swallowing it', async () => {
    const rejected = new Error('The selected item no longer exists.')
    let resolveStatus: (status: DocumentMutationFailure | null) => void = () =>
      undefined
    const status = new Promise<DocumentMutationFailure | null>((resolve) => {
      resolveStatus = resolve
    })
    const onStatusChange: DocumentMutationStatusListener = resolveStatus
    const mutations = documentMutationHandlers(
      {
        edit: async () => {
          throw rejected
        },
        insert: unusedOperation,
        move: unusedOperation,
        remove: unusedOperation,
        removeAt: unusedOperation,
      },
      onStatusChange
    )

    mutations.onEdit(['experience', 2, 'role'], 'Staff Engineer')

    expect(await status).toEqual({
      cause: rejected,
      message:
        'Could not edit experience › item 3 › role. The selected item no longer exists.',
      operation: 'edit',
      path: ['experience', 2, 'role'],
    })
  })

  test('reports synchronous adapter failures through the same channel', async () => {
    const rejected = new Error('Malformed document path.')
    let resolveStatus: (status: DocumentMutationFailure | null) => void = () =>
      undefined
    const status = new Promise<DocumentMutationFailure | null>((resolve) => {
      resolveStatus = resolve
    })
    const mutations = documentMutationHandlers(
      {
        edit: unusedOperation,
        insert: () => {
          throw rejected
        },
        move: unusedOperation,
        remove: unusedOperation,
        removeAt: unusedOperation,
      },
      resolveStatus
    )

    mutations.onAdd?.(['projects'], { name: 'New project' }, 1)

    expect(await status).toMatchObject({
      cause: rejected,
      operation: 'add',
      path: ['projects', 1],
    })
  })

  test('keeps an invalid intermediate draft and reports a successful mutation', async () => {
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const session = yield* makeDocumentStudioSession({
            applicationId: 'application-1',
            kind: 'cover_letter',
            locale: 'en',
            referenceCvRevisionId: 'cv-revision-1',
          })
          let resolveStatus: (status: DocumentMutationFailure | null) => void =
            () => undefined
          const status = new Promise<DocumentMutationFailure | null>(
            (resolve) => {
              resolveStatus = resolve
            }
          )
          const mutations = documentMutationHandlers(
            {
              edit: (path, value) =>
                Effect.runPromise(session.edit(path, value)),
              insert: (path, index, value) =>
                Effect.runPromise(session.insert(path, index, value)),
              move: (path, fromIndex, toIndex) =>
                Effect.runPromise(session.move(path, fromIndex, toIndex)),
              remove: (path) => Effect.runPromise(session.remove(path)),
              removeAt: (path, index) =>
                Effect.runPromise(session.removeAt(path, index)),
            },
            resolveStatus
          )

          mutations.onEdit(['body'], '')

          expect(yield* Effect.promise(() => status)).toBeNull()
          expect(session.snapshot().document).toMatchObject({ body: '' })
          expect(session.snapshot().valid).toBe(false)
        })
      )
    )
  })
})
