import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import {
  OpaqueContentEnvelopeSchema,
  OpaqueInlineContentEnvelopeSchema,
  OpaqueStoredContentEnvelopeSchema,
  opaqueContentEnvelopeVersion,
} from './index'

const metadata = {
  contract: {
    id: 'cv.document',
    version: 1,
  },
  locale: 'en',
  mediaType: 'application/json',
  sha256: 'f'.repeat(64),
  byteLength: 123,
}

describe('opaque delivery envelopes', () => {
  test('carries arbitrary JSON without importing a concrete content schema', () => {
    const envelope = Schema.decodeUnknownSync(
      OpaqueInlineContentEnvelopeSchema
    )({
      envelopeVersion: opaqueContentEnvelopeVersion,
      kind: 'inline',
      metadata,
      payload: {
        shape: 'owned-by-another-contract',
        nested: [1, true, null],
      },
    })

    expect(envelope.kind).toBe('inline')
    expect(envelope.metadata.contract.id).toBe('cv.document')
    expect(envelope.payload).toEqual({
      shape: 'owned-by-another-contract',
      nested: [1, true, null],
    })
  })

  test('decodes a provider-neutral stored object reference', () => {
    const envelope = Schema.decodeUnknownSync(
      OpaqueStoredContentEnvelopeSchema
    )({
      envelopeVersion: 1,
      kind: 'stored',
      metadata: { ...metadata, contract: { id: 'cv.facts', version: 1 } },
      object: {
        key: 'facts/manifests/release-1.json',
        etag: 'immutable-etag',
      },
    })

    expect(envelope.kind).toBe('stored')
    expect(envelope.object.key).toBe('facts/manifests/release-1.json')
  })

  test('rejects invalid hashes, sizes, object keys, and excess metadata', () => {
    expect(() =>
      Schema.decodeUnknownSync(OpaqueInlineContentEnvelopeSchema)({
        envelopeVersion: 1,
        kind: 'inline',
        metadata: { ...metadata, sha256: 'bad' },
        payload: {},
      })
    ).toThrow()

    expect(() =>
      Schema.decodeUnknownSync(OpaqueInlineContentEnvelopeSchema)({
        envelopeVersion: 1,
        kind: 'inline',
        metadata: { ...metadata, byteLength: -1 },
        payload: {},
      })
    ).toThrow()

    expect(() =>
      Schema.decodeUnknownSync(OpaqueStoredContentEnvelopeSchema)({
        envelopeVersion: 1,
        kind: 'stored',
        metadata,
        object: { key: 'documents/../private.json' },
      })
    ).toThrow('Object key')

    expect(() =>
      Schema.decodeUnknownSync(OpaqueInlineContentEnvelopeSchema)({
        envelopeVersion: 1,
        kind: 'inline',
        metadata: { ...metadata, rendererSpecificField: true },
        payload: {},
      })
    ).toThrow()
  })

  test('dispatches the envelope union by its kind', () => {
    const inline = Schema.decodeUnknownSync(OpaqueContentEnvelopeSchema)({
      envelopeVersion: 1,
      kind: 'inline',
      metadata,
      payload: null,
    })
    const stored = Schema.decodeUnknownSync(OpaqueContentEnvelopeSchema)({
      envelopeVersion: 1,
      kind: 'stored',
      metadata,
      object: { key: 'documents/sha256/content.json' },
    })

    expect(inline.kind).toBe('inline')
    expect(stored.kind).toBe('stored')
  })

  test('emits strict JSON Schema without concrete CV or facts fields', () => {
    const jsonSchema = Schema.toJsonSchemaDocument(OpaqueContentEnvelopeSchema)
    const serialized = JSON.stringify(jsonSchema)

    expect(serialized).toContain('"additionalProperties":false')
    expect(serialized).toContain('"payload"')
    expect(serialized).not.toContain('"experience"')
    expect(serialized).not.toContain('"claims"')
  })
})
