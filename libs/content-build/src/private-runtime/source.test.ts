import { describe, expect, test } from 'bun:test'
import type { ContentRegistry } from '@cv/content-composer'
import { Effect } from 'effect'
import { loadContentVariablesSource } from './source'

describe('content variables source', () => {
  test('loads variables from the content directory only', () => {
    const registry = {
      mdxModules: {},
      modules: {
        'content/variables.ts': {
          default: {
            variables: {
              current: 'current value',
            },
          },
        },
        'variables.ts': {
          default: {
            variables: {
              unrelated: 'unrelated value',
            },
          },
        },
      },
    } satisfies ContentRegistry

    const source = Effect.runSync(
      loadContentVariablesSource(registry, 'content')
    )

    expect(source?.variables.current).toBe('current value')
    expect(source?.variables.unrelated).toBeUndefined()
  })

  test('does not fall back to root variables.ts', () => {
    const registry = {
      mdxModules: {},
      modules: {
        'variables.ts': {
          default: {
            variables: {
              unrelated: 'unrelated value',
            },
          },
        },
      },
    } satisfies ContentRegistry

    const source = Effect.runSync(
      loadContentVariablesSource(registry, 'content')
    )

    expect(source).toBeNull()
  })
})
