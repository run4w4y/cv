import { describe, expect, it } from 'bun:test'
import { Schema } from 'effect'

import { createInitialValue } from './initial-value'
import { inspectSchema } from './inspect-schema'
import { appendJsonPointer, toJsonPointer } from './json-pointer'
import { formatRawJson, parseRawJson } from './raw-json'
import { validateSchemaValue } from './validation'

const SyntheticSchema = Schema.Struct({
  name: Schema.NonEmptyString.annotate({
    title: 'Name',
    description: 'A synthetic display name.',
  }),
  score: Schema.optional(Schema.Number),
  tags: Schema.Array(Schema.String),
  visibility: Schema.Union([
    Schema.Literal('public'),
    Schema.Literal('private'),
  ]),
  nickname: Schema.NullOr(Schema.String),
  preferences: Schema.Struct({ enabled: Schema.Boolean }),
})

describe('runtime schema inspection', () => {
  it('builds a neutral descriptor from a synthetic structural schema', () => {
    const inspection = inspectSchema(SyntheticSchema)
    expect(inspection.structurallyEditable).toBe(true)
    expect(inspection.unsupported).toEqual([])

    const root = inspection.descriptor
    if (root.kind !== 'object') throw new Error('Expected an object descriptor')

    const fields = Object.fromEntries(
      root.fields.map((field) => [field.key, field])
    )
    expect(fields.name?.descriptor.kind).toBe('string')
    expect(fields.name?.descriptor.title).toBe('Name')
    expect(fields.score?.optional).toBe(true)
    expect(fields.tags?.descriptor.kind).toBe('array')
    expect(fields.visibility?.descriptor.kind).toBe('choice')
    expect(fields.nickname?.descriptor.kind).toBe('nullable')
    expect(fields.preferences?.descriptor.kind).toBe('object')

    expect(createInitialValue(root)).toEqual({
      name: '',
      tags: [],
      visibility: 'public',
      nickname: null,
      preferences: { enabled: false },
    })
  })

  it('uses the encoded representation while retaining transformation metadata', () => {
    const descriptor = inspectSchema(
      Schema.NumberFromString.annotate({
        title: 'Encoded number',
        default: 42,
        examples: [1, 2],
      })
    ).descriptor
    expect(descriptor.kind).toBe('string')
    expect(descriptor.encoded).toBe(true)
    expect(descriptor.title).toBe('Encoded number')
    expect(descriptor.defaultValue).toBeUndefined()
    expect(descriptor.examples).toBeUndefined()
    expect(typeof createInitialValue(descriptor)).toBe('string')
  })

  it('preserves explicit null metadata when an outer schema overrides a child', () => {
    const inner = Schema.NullOr(Schema.String).annotate({ default: 'inner' })
    const descriptor = inspectSchema(
      Schema.suspend(() => inner).annotate({ default: null })
    ).descriptor

    expect(descriptor.defaultValue).toBeNull()
  })

  it('detects structural nodes that require the raw JSON fallback', () => {
    const tuple = inspectSchema(Schema.Tuple([Schema.String, Schema.Number]))
    expect(tuple.structurallyEditable).toBe(false)
    expect(tuple.descriptor.kind).toBe('raw')
    expect(tuple.unsupported).toEqual([
      {
        pointer: '',
        astTag: 'Arrays',
        reason:
          'Tuples and arrays with trailing elements require raw JSON editing.',
        fallback: 'raw-json',
      },
    ])
    expect(tuple.jsonEditable).toBe(true)

    const unknown = inspectSchema(Schema.Unknown)
    expect(unknown.descriptor.kind).toBe('raw')
    expect(unknown.unsupported[0]?.astTag).toBe('Unknown')
  })

  it('distinguishes raw JSON fallbacks from non-JSON wire values', () => {
    const bigint = inspectSchema(Schema.BigInt)
    const bigintTuple = inspectSchema(Schema.Tuple([Schema.BigInt]))

    expect(bigint.descriptor.kind).toBe('unrepresentable')
    expect(bigint.jsonEditable).toBe(false)
    expect(bigint.unsupported[0]?.fallback).toBe('unrepresentable')
    expect(bigintTuple.descriptor.kind).toBe('unrepresentable')
    expect(bigintTuple.jsonEditable).toBe(false)
  })

  it('uses raw JSON for empty object ASTs with non-object values', () => {
    const inspection = inspectSchema(Schema.Struct({}))

    expect(inspection.descriptor.kind).toBe('raw')
    expect(inspection.jsonEditable).toBe(true)
    expect(validateSchemaValue(Schema.Struct({}), 1).valid).toBe(true)
  })

  it('keeps reliably discriminated unions structural and ambiguous unions raw', () => {
    const discriminated = inspectSchema(
      Schema.Union([
        Schema.Struct({ kind: Schema.Literal('a'), a: Schema.String }),
        Schema.Struct({ kind: Schema.Literal('b'), b: Schema.Number }),
      ])
    )
    const ambiguous = inspectSchema(
      Schema.Union([
        Schema.Struct({ a: Schema.String }),
        Schema.Struct({ b: Schema.Number }),
      ])
    )
    const distinctJsonTypes = inspectSchema(
      Schema.Union([Schema.Struct({ value: Schema.String }), Schema.String])
    )

    expect(discriminated.descriptor.kind).toBe('union')
    expect(discriminated.structurallyEditable).toBe(true)
    expect(distinctJsonTypes.descriptor.kind).toBe('union')
    expect(ambiguous.descriptor.kind).toBe('raw')
    expect(ambiguous.unsupported[0]?.reason).toMatch(/unambiguously/i)
  })
})

describe('generic validation and JSON boundaries', () => {
  it('maps Effect validation issues to escaped JSON Pointers', () => {
    const schema = Schema.Struct({
      name: Schema.NonEmptyString,
      nested: Schema.Struct({ values: Schema.Array(Schema.Number) }),
    })
    const result = validateSchemaValue(schema, {
      name: '',
      nested: { values: [1, 'wrong'] },
    })

    expect(result.valid).toBe(false)
    if (result.valid) throw new Error('Expected validation to fail')
    expect(result.issues.map((issue) => issue.pointer)).toEqual([
      '/name',
      '/nested/values/1',
    ])
    expect(toJsonPointer(['a/b', '~value', 2])).toBe('/a~1b/~0value/2')
    expect(appendJsonPointer('/items', 'a/b')).toBe('/items/a~1b')
  })

  it('parses and formats raw JSON without throwing validation errors', () => {
    expect(parseRawJson('{"ok":true}')).toEqual({
      valid: true,
      value: { ok: true },
    })
    const invalid = parseRawJson('{')
    expect(invalid.valid).toBe(false)
    expect(formatRawJson({ ok: true })).toEqual({
      valid: true,
      source: '{\n  "ok": true\n}',
    })
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(formatRawJson(cyclic)).toEqual({
      valid: false,
      message: 'The current value cannot be represented as JSON.',
    })
    expect(formatRawJson(1n).valid).toBe(false)
    expect(formatRawJson(new Date()).valid).toBe(false)
    expect(validateSchemaValue(Schema.Number, Infinity)).toEqual({
      valid: false,
      issues: [
        {
          pointer: '',
          path: [],
          message: 'The value cannot be represented as JSON.',
        },
      ],
    })
    expect(
      formatRawJson(Object.assign({}, { [Symbol('hidden')]: 1 })).valid
    ).toBe(false)
    const sparse: Array<unknown> = []
    sparse.length = 1
    expect(formatRawJson(sparse).valid).toBe(false)
  })
})
