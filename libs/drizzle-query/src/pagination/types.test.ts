import { describe, expect, test } from 'bun:test'
import { integer, sqliteTable } from 'drizzle-orm/sqlite-core'

import { defineQuery } from '../query/index'
import type {
  PaginationImplementation,
  PaginationInfoOf,
  PaginationKindOf,
  PaginationRequestOf,
} from './types'

const records = sqliteTable('custom_pagination_records', {
  id: integer('id').primaryKey(),
})

type WindowRequest = { readonly take?: number }
type WindowInfo = {
  readonly kind: 'window'
  readonly label: string
}

const pageInfo: WindowInfo = { kind: 'window', label: 'consumer-owned' }

const pagination = {
  kind: 'window',
  usesCursor: false,
  compile: (request) => {
    const size = request?.take ?? 1
    return {
      kind: 'window',
      size,
      limit: size,
      offset: undefined,
      finish: <Row>(rows: readonly Row[]) => ({
        items: rows.slice(0, size),
        pageInfo,
      }),
    }
  },
} satisfies PaginationImplementation<WindowRequest, WindowInfo, 'window'>

const typeContracts = (): void => {
  const request: PaginationRequestOf<typeof pagination> = { take: 2 }
  const compiled = pagination.compile(request)
  const info: PaginationInfoOf<typeof pagination> = compiled.finish([]).pageInfo
  const kind: PaginationKindOf<typeof pagination> = compiled.kind
  const label: string = info.label

  void info
  void kind
  void label

  // @ts-expect-error the request is inferred from the compile method
  const invalidRequest: PaginationRequestOf<typeof pagination> = { page: 1 }
  // @ts-expect-error the kind is inferred from the compilation return type
  const invalidKind: PaginationKindOf<typeof pagination> = 'page'

  void invalidRequest
  void invalidKind
}

void typeContracts

describe('custom pagination contract', () => {
  test('uses implementation bounds and page information directly', () => {
    const definition = defineQuery(
      records,
      ({ col }) => [col.id.sortable({ unique: true })],
      { pagination }
    )

    const resolution = pagination.compile({ take: 1 })
    const compiled = definition.resolve({ pagination: { take: 1 } })
    const page = compiled.finalize([{ id: 1 }, { id: 2 }])

    expect(resolution).toMatchObject({
      kind: 'window',
      size: 1,
      limit: 1,
    })
    expect(page.items).toEqual([{ id: 1 }])
    expect(page.pageInfo).toBe(pageInfo)
  })

  test('preserves an inline implementation without a variable annotation', () => {
    const definition = defineQuery(
      records,
      ({ col }) => [col.id.sortable({ unique: true })],
      {
        pagination: {
          kind: 'window' as const,
          usesCursor: false,
          compile(request: WindowRequest | undefined) {
            const size = request?.take ?? 1

            return {
              kind: 'window' as const,
              size,
              limit: size,
              offset: undefined,
              finish: <Row>(rows: readonly Row[]) => ({
                items: rows.slice(0, size),
                pageInfo,
              }),
            }
          },
        },
      }
    )

    const compiled = definition.resolve({ pagination: { take: 2 } })
    const page = compiled.finalize([{ id: 1 }, { id: 2 }, { id: 3 }])
    const label: string = page.pageInfo.label
    const inlineTypeContracts = (): void => {
      // @ts-expect-error inline compile parameters determine the request shape
      definition.resolve({ pagination: { page: 1 } })
    }

    void inlineTypeContracts

    expect(page.items).toEqual([{ id: 1 }, { id: 2 }])
    expect(label).toBe('consumer-owned')
  })
})
