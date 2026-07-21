import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import * as publicApi from './index'

const publicRuntimeExports = [
  'ResolvedQuery',
  'QueryDefinition',
  'QueryError',
  'appendQueryParam',
  'appendOperators',
  'bigintOperators',
  'binaryFilterOperator',
  'booleanOperators',
  'comparisonOperators',
  'cursorPagination',
  'dateOperators',
  'decodeFlatQueryParams',
  'defaultCursorCodec',
  'defineQuery',
  'enumOperators',
  'encodeFlatQueryParams',
  'equalityOperators',
  'formatFilterExpression',
  'formatSortExpression',
  'nullableOperators',
  'maxCompactFilterLength',
  'maxCompactSortLength',
  'maxCompactSortTerms',
  'maxQueryFilterDepth',
  'maxQueryFilterNodes',
  'normalizeQueryFilterNodes',
  'normalizeOperators',
  'numberOperators',
  'pagePagination',
  'parseFilterExpression',
  'parseSortExpression',
  'pickOperators',
  'queryParamValues',
  'queryParamsFromRecord',
  'queryParamsRecord',
  'replaceOperator',
  'replaceQueryParam',
  'reservedQueryParameters',
  'textOperators',
  'unaryFilterOperator',
  'withoutOperators',
] as const

describe('package entrypoint', () => {
  test('exposes only the supported runtime API', () => {
    expect(Object.keys(publicApi).sort()).toEqual(
      [...publicRuntimeExports].sort()
    )
  })

  test('loads the package exports by name with native Node ESM', () => {
    const packageRoot = fileURLToPath(new URL('..', import.meta.url))
    const result = spawnSync(
      'node',
      [
        '--input-type=module',
        '--eval',
        `await import(${JSON.stringify('@cv/drizzle-query')})`,
      ],
      { cwd: packageRoot, encoding: 'utf8' }
    )

    expect(result.status, result.stderr).toBe(0)
  })
})
