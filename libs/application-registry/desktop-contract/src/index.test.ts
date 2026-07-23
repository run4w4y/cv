import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'

import {
  DesktopCodexGenerationRequestSchema,
  DesktopFetchRequestSchema,
  DesktopRegistryConfigureSchema,
} from './index'

describe('desktop IPC schemas', () => {
  test('accepts a valid structured Codex generation request', () => {
    expect(
      Schema.is(DesktopCodexGenerationRequestSchema)({
        operationId: 'operation-1',
        outputSchema: { type: 'object' },
        prompt: 'Return JSON.',
      })
    ).toBe(true)
  })

  test('allows stored Registry settings to keep their existing token', () => {
    expect(
      Schema.is(DesktopRegistryConfigureSchema)({
        origin: 'https://registry.example.test',
      })
    ).toBe(true)
    expect(
      Schema.is(DesktopRegistryConfigureSchema)({
        origin: 'http://[::1]:3000',
      })
    ).toBe(true)
  })

  test('rejects malformed IPC values before they reach capabilities', () => {
    expect(
      Schema.is(DesktopCodexGenerationRequestSchema)({
        operationId: '',
        outputSchema: [],
        prompt: 'Return JSON.',
      })
    ).toBe(false)
    expect(
      Schema.is(DesktopFetchRequestSchema)({
        body: null,
        headers: 'authorization: secret',
        method: 'GET',
        url: '/api/registry',
      })
    ).toBe(false)
    expect(
      Schema.is(DesktopRegistryConfigureSchema)({ origin: '', token: '' })
    ).toBe(false)
    expect(
      Schema.is(DesktopRegistryConfigureSchema)({
        origin: 'http://registry.example.test',
      })
    ).toBe(true)
  })
})
