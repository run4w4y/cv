import { describe, expect, test } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import * as publicApi from './index'

describe('package entrypoints', () => {
  test('exposes the supported root API', () => {
    expect(Object.keys(publicApi)).toContain('resolveQuery')
    expect(Object.keys(publicApi)).toContain('CursorPageInfoSchema')
    expect(Object.keys(publicApi)).toContain('queryRequestSchema')
    expect(Object.keys(publicApi)).toContain('queryParamsSchema')
    expect(Object.keys(publicApi)).toContain('queryParamsCodec')
    expect(Object.keys(publicApi)).toContain('schemaBinaryFilterOperator')
    expect(Object.keys(publicApi)).toContain('schemaCursorState')
    expect(Object.keys(publicApi)).toContain('toSearchParams')
    expect(Object.keys(publicApi)).toContain('fromSearchParams')
    expect(Object.keys(publicApi)).not.toContain('toSearchParamsSync')
    expect(Object.keys(publicApi)).not.toContain('fromSearchParamsSync')
  })

  test('loads both package exports with native Node ESM', () => {
    const packageRoot = fileURLToPath(new URL('..', import.meta.url))

    for (const entrypoint of [
      '@cv/drizzle-query-effect',
      '@cv/drizzle-query-effect/schema',
    ]) {
      const result = spawnSync(
        'node',
        [
          '--input-type=module',
          '--eval',
          `await import(${JSON.stringify(entrypoint)})`,
        ],
        { cwd: packageRoot, encoding: 'utf8' }
      )

      expect(result.status, result.stderr).toBe(0)
    }
  })
})
