import { describe, expect, test } from 'bun:test'
import { CvDocumentV1Schema } from '@cv/contracts/document'
import { Schema } from 'effect'

import { CoverLetterDocumentSchema } from '../cover-letter/contract'
import {
  EvidencePlanSchema,
  JobAnalysisSchema,
  SectionBriefSchema,
} from '../domain'
import { toGenerationContract } from './ai-schema'

const unsupportedKeywords = new Set([
  'allOf',
  'dependentRequired',
  'dependentSchemas',
  'else',
  'if',
  'maxProperties',
  'minProperties',
  'not',
  'oneOf',
  'patternProperties',
  'propertyNames',
  'then',
  'unevaluatedItems',
  'unevaluatedProperties',
])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const assertOpenAiStrictSchema = (
  value: unknown,
  schemaName: string,
  path = '$'
): void => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertOpenAiStrictSchema(item, schemaName, `${path}[${index}]`)
    })
    return
  }
  if (!isRecord(value)) return

  for (const [key, child] of Object.entries(value)) {
    expect(
      unsupportedKeywords.has(key),
      `${schemaName} contains unsupported keyword ${key} at ${path}`
    ).toBe(false)
    assertOpenAiStrictSchema(child, schemaName, `${path}.${key}`)
  }

  if (value.type !== 'object' || !isRecord(value.properties)) return

  expect(
    value.additionalProperties,
    `${schemaName} must reject extra properties at ${path}`
  ).toBe(false)
  expect(
    [...((value.required as ReadonlyArray<string> | undefined) ?? [])].sort(),
    `${schemaName} must require every property at ${path}`
  ).toEqual(Object.keys(value.properties).sort())
}

const workflowSchemas = [
  ['job analysis', () => toGenerationContract(JobAnalysisSchema)],
  ['evidence plan', () => toGenerationContract(EvidencePlanSchema)],
  ['section brief', () => toGenerationContract(SectionBriefSchema)],
  ['cover letter', () => toGenerationContract(CoverLetterDocumentSchema)],
  ['CV document', () => toGenerationContract(CvDocumentV1Schema)],
] as const

describe('OpenAI structured-output contracts', () => {
  for (const [name, makeContract] of workflowSchemas) {
    test(`converts the ${name} schema to the strict OpenAI subset`, () => {
      const contract = makeContract()

      expect(contract.outputSchema.type).toBe('object')
      assertOpenAiStrictSchema(contract.outputSchema, name)
    })
  }

  test('uses the paired codec to restore omitted optional keys', () => {
    const SourceSchema = Schema.Struct({
      id: Schema.String,
      note: Schema.optionalKey(Schema.String),
    })
    const contract = toGenerationContract(SourceSchema)
    const properties = contract.outputSchema.properties

    if (!isRecord(properties)) {
      throw new Error('Expected root object properties.')
    }

    expect(contract.outputSchema.required).toEqual(['id', 'note'])
    expect(properties.note).toEqual({
      anyOf: [{ type: 'string' }, { type: 'null' }],
    })
    expect(
      Schema.decodeUnknownSync(contract.codec)({ id: 'item-1', note: null })
    ).toEqual({ id: 'item-1' })
  })
})
