import { describe, expect, test } from 'bun:test'
import type { AiJsonSchema } from '@cv/ai-provider'
import { buildAppendRevisionRequest, type ContentEntry } from './api'
import { decodeJsonBase64 } from './base64'
import {
  buildCoverLetterGenerationRequest,
  buildCvDraftGenerationRequest,
} from './prompts'

const arbitrarySchema = {
  type: 'object',
  additionalProperties: false,
  properties: { completelyDynamic: { type: 'string' } },
  required: ['completelyDynamic'],
} satisfies AiJsonSchema

const entry: ContentEntry = {
  id: 'entry-1',
  applicationId: 'application-1',
  kind: 'cv',
  locale: 'en',
  state: 'draft',
  headRevisionId: null,
  approvedRevisionId: null,
  version: 7,
  createdAt: '2026-07-17T00:00:00.000Z',
  updatedAt: '2026-07-17T00:00:00.000Z',
}

describe('preparation request construction', () => {
  test('passes arbitrary schema, complete context, and generic guidance to CV generation', () => {
    const facts = { claims: [{ id: 'fact-x', arbitrary: 'truth' }] }
    const job = { requirements: ['something unusual'] }
    const guidance = { paths: [{ pointer: '/completelyDynamic' }] }
    const request = buildCvDraftGenerationRequest({
      factsCatalogue: facts,
      guidance,
      jobContext: job,
      locale: 'en',
      modelId: 'model-1',
      schema: arbitrarySchema,
    })

    expect(request.schema).toBe(arbitrarySchema)
    expect(request.prompt).toContain(JSON.stringify(facts, null, 2))
    expect(request.prompt).toContain(JSON.stringify(job, null, 2))
    expect(request.prompt).toContain(JSON.stringify(guidance, null, 2))
  })

  test('keeps the user-authored cover-letter prompt separate and complete', () => {
    const request = buildCoverLetterGenerationRequest({
      factsCatalogue: { anyFactsShape: true },
      jobContext: 'posting text',
      locale: 'en',
      modelId: 'model-2',
      prompt: 'Prefer a direct opening.',
      schema: arbitrarySchema,
    })

    expect(request.prompt).toContain('Prefer a direct opening.')
    expect(request.prompt).toContain('anyFactsShape')
    expect(request.schema).toBe(arbitrarySchema)
  })

  test('serializes an opaque revision and pins all provenance IDs', () => {
    const value = { noKnownFieldsRequired: ['a', 2, false] }
    const request = buildAppendRevisionRequest({
      contractId: 'dynamic.contract',
      contractVersion: '99',
      entry,
      factsReleaseId: 'facts-release-1',
      jobSnapshotId: 'job-snapshot-1',
      operationId: 'operation-1',
      source: 'human',
      value,
    })

    expect(request.expectedVersion).toBe(7)
    expect(request.factsReleaseId).toBe('facts-release-1')
    expect(request.jobSnapshotId).toBe('job-snapshot-1')
    expect(request.payload.mediaType).toBe('application/json')
    expect(decodeJsonBase64(request.payload.data)).toEqual(value)
  })
})
