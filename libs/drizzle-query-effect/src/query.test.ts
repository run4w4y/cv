import { describe, expect, test } from 'bun:test'
import { type CursorPageInfo, QueryError } from '@cv/drizzle-query'
import { Effect } from 'effect'

import { finalizeQuery, resolveQuery } from './query'

describe('Effect query integration', () => {
  test('preserves required resolution context in its call signature', async () => {
    const definition = {
      resolve: (
        input: { readonly value?: number } = {},
        options: { readonly context: { readonly tenant: string } }
      ) => ({ input, tenant: options.context.tenant }),
    }

    const result = await Effect.runPromise(
      resolveQuery(
        definition,
        { value: 2 },
        { context: { tenant: 'tenant-a' } }
      )
    )
    const typeContracts = (): void => {
      // @ts-expect-error contextual definitions require their resolve options
      resolveQuery(definition, { value: 2 })
    }
    void typeContracts

    expect(result).toEqual({
      input: { value: 2 },
      tenant: 'tenant-a',
    })
  })

  test('maps core query errors into a typed Effect failure', async () => {
    const failure = await Effect.runPromise(
      resolveQuery({
        resolve: () => {
          throw new QueryError('invalid-pagination', 'Invalid size.', {
            path: 'pagination.size',
          })
        },
      }).pipe(Effect.flip)
    )

    expect(failure).toBeInstanceOf(QueryError)
    expect(failure.code).toBe('invalid-pagination')
    expect(failure.path).toBe('pagination.size')
  })

  test('does not turn unexpected exceptions into expected failures', async () => {
    const defect = new TypeError('unexpected')
    const exit = await Effect.runPromiseExit(
      resolveQuery({
        resolve: () => {
          throw defect
        },
      })
    )

    expect(exit._tag).toBe('Failure')
    expect(String(exit)).toContain('unexpected')
  })

  test('finalizes rows through any structural query view', async () => {
    const pageInfo: CursorPageInfo = {
      kind: 'cursor',
      size: 1,
      hasNextPage: false,
      hasPreviousPage: false,
      nextCursor: null,
    }
    const relationalView = {
      finalize: (
        rows: readonly { readonly id: number }[],
        totalItems?: number
      ) => ({
        items: rows,
        pageInfo: { ...pageInfo, totalItems },
      }),
    }

    const page = await Effect.runPromise(
      finalizeQuery(relationalView, [{ id: 1 }], 7)
    )

    expect(page).toEqual({
      items: [{ id: 1 }],
      pageInfo: { ...pageInfo, totalItems: 7 },
    })
  })

  test('maps finalizer query errors into a typed Effect failure', async () => {
    const failure = await Effect.runPromise(
      finalizeQuery(
        {
          finalize: (_rows: readonly unknown[]) => {
            throw new QueryError(
              'invalid-ordering',
              'Missing relational cursor projection.',
              { path: 'row.__drizzle_query_term_0' }
            )
          },
        },
        []
      ).pipe(Effect.flip)
    )

    expect(failure).toBeInstanceOf(QueryError)
    expect(failure.code).toBe('invalid-ordering')
    expect(failure.path).toBe('row.__drizzle_query_term_0')
  })
})
