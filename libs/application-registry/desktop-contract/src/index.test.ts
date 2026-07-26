import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'

import {
  DesktopCodexGenerationRequestSchema,
  DesktopDocumentAssistantRequestSchema,
  DesktopDocumentAssistantResultSchema,
  DesktopFetchRequestSchema,
  DesktopRegistryConfigureSchema,
  DocumentAssistantResponseSchema,
  DocumentPatchSchema,
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

  test('models chat-only and ordered document-editing assistant responses', () => {
    expect(
      Schema.is(DocumentAssistantResponseSchema)({
        patches: [],
        reply: 'I would keep the opening concise.',
      })
    ).toBe(true)
    expect(
      Schema.is(DocumentAssistantResponseSchema)({
        patches: [
          {
            op: 'add',
            path: ['experience', 0, 'highlights', 1],
            value: 'Reduced deployment time by 40%.',
          },
          {
            op: 'replace',
            path: ['person', 'summary'],
            value: 'Product-focused software engineer.',
          },
          {
            op: 'remove',
            path: ['additionalSections', 0],
          },
        ],
        reply: 'I tightened the summary and supporting evidence.',
      })
    ).toBe(true)
  })

  test('keeps patch operations and tuple paths precise', () => {
    expect(() =>
      Schema.decodeUnknownSync(DocumentPatchSchema)(
        {
          op: 'remove',
          path: ['skills', 0],
          value: 'must not be accepted',
        },
        { onExcessProperty: 'error' }
      )
    ).toThrow()
    expect(
      Schema.is(DocumentPatchSchema)({
        op: 'replace',
        path: [],
        value: 'root replacement',
      })
    ).toBe(false)
    expect(
      Schema.is(DocumentPatchSchema)({
        op: 'add',
        path: ['experience', -1],
        value: {},
      })
    ).toBe(false)
  })

  test('carries operation, checkpoint, and thread identity across a turn', () => {
    expect(
      Schema.is(DesktopDocumentAssistantRequestSchema)({
        checkpointId: 'draft-7',
        document: { body: 'Current draft' },
        operationId: 'assistant-turn-7',
        prompt: 'Make the opening more direct.',
        protectedPaths: [['$schema'], ['locale']],
        threadId: '019f9519-65fa-72a2-aa56-07b9b419aac7',
      })
    ).toBe(true)
    expect(
      Schema.is(DesktopDocumentAssistantResultSchema)({
        checkpointId: 'draft-7',
        operationId: 'assistant-turn-7',
        response: {
          patches: [{ op: 'replace', path: ['body'], value: 'Revised draft' }],
          reply: 'I made the opening more direct.',
        },
        threadId: '019f9519-65fa-72a2-aa56-07b9b419aac7',
        usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
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
      Schema.is(DesktopDocumentAssistantRequestSchema)({
        checkpointId: '',
        document: {},
        operationId: 'assistant-turn-1',
        prompt: '',
        threadId: ' ',
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
