import { describe, expect, test } from 'bun:test'
import { Option, Schema } from 'effect'
import {
  cvFactsV1ContractId,
  cvFactsV1Version,
  FactClaimV1Schema,
  FactsCatalogueV1Schema,
  FactsCatalogueV1StructureSchema,
  factsSchemaRegistry,
  getFactsContract,
  getGenerationGuidance,
  inspectFactsCatalogueV1Integrity,
} from './index'

const validCatalogue = {
  $schema: 'cv.facts.v1',
  locale: 'en',
  claims: [
    {
      id: 'employment.analytical-engine.role',
      status: 'approved',
      topic: 'employment',
      statement:
        'Worked as a software engineer at Analytical Engines from 2023 to the present.',
      tags: ['role.software-engineering'],
      evidence: [
        {
          kind: 'personal-review',
          label: 'Reviewed employment history',
        },
      ],
    },
  ],
  presets: [
    {
      id: 'preset.experience.analytical-engine',
      status: 'approved',
      purpose: 'experience-summary',
      text: 'Software engineer at Analytical Engines since 2023.',
      claimIds: ['employment.analytical-engine.role'],
      tags: ['role.software-engineering'],
    },
  ],
  assets: [
    {
      id: 'asset.bachelor-thesis',
      label: 'Bachelor thesis',
      description: 'Reviewed bachelor thesis supporting the education claim.',
      mediaType: 'application/pdf',
      sha256: 'a'.repeat(64),
      claimIds: ['employment.analytical-engine.role'],
    },
  ],
}

describe('cv.facts.v1', () => {
  test('decodes an approved, single-locale facts catalogue', () => {
    const catalogue = Schema.decodeUnknownSync(FactsCatalogueV1Schema)(
      validCatalogue
    )

    expect(catalogue.$schema).toBe(cvFactsV1ContractId)
    expect(catalogue.claims[0]?.status).toBe('approved')
    expect(catalogue.presets[0]?.claimIds).toEqual([
      'employment.analytical-engine.role',
    ])
  })

  test('rejects unapproved content and malformed asset hashes', () => {
    expect(() =>
      Schema.decodeUnknownSync(FactsCatalogueV1Schema)({
        ...validCatalogue,
        claims: [{ ...validCatalogue.claims[0], status: 'draft' }],
      })
    ).toThrow()

    expect(() =>
      Schema.decodeUnknownSync(FactsCatalogueV1Schema)({
        ...validCatalogue,
        assets: [{ ...validCatalogue.assets[0], sha256: 'not-a-hash' }],
      })
    ).toThrow()

    expect(() =>
      Schema.decodeUnknownSync(FactsCatalogueV1Schema)({
        ...validCatalogue,
        locale: 'en-GB',
      })
    ).toThrow()
  })

  test('reports duplicate IDs and dangling claim references together', () => {
    const invalidCatalogue = {
      ...validCatalogue,
      claims: [validCatalogue.claims[0], validCatalogue.claims[0]],
      presets: [
        {
          ...validCatalogue.presets[0],
          claimIds: ['claim.does-not-exist'],
        },
      ],
    }
    const issues = inspectFactsCatalogueV1Integrity(
      Schema.decodeUnknownSync(FactsCatalogueV1StructureSchema)(
        invalidCatalogue
      )
    )

    expect(issues).toHaveLength(2)
    expect(() =>
      Schema.decodeUnknownSync(FactsCatalogueV1Schema)(invalidCatalogue)
    ).toThrow('Duplicate claims identifier')
    expect(() =>
      Schema.decodeUnknownSync(FactsCatalogueV1Schema)(invalidCatalogue)
    ).toThrow('Unknown claim reference')
  })

  test('exposes authoring guidance on factual statements', () => {
    const guidance = getGenerationGuidance(FactClaimV1Schema.fields.statement)

    expect(Option.isSome(guidance)).toBe(true)
    if (Option.isSome(guidance)) {
      expect(guidance.value.sources).toEqual(['human-reviewed'])
      expect(guidance.value.instruction).toContain('verified')
    }
  })

  test('registers facts independently from the document contract', () => {
    expect(factsSchemaRegistry[0]?.contractId).toBe(cvFactsV1ContractId)
    expect(factsSchemaRegistry[0]?.version).toBe(cvFactsV1Version)
    expect(Option.isSome(getFactsContract(cvFactsV1ContractId))).toBe(true)
    expect(Option.isNone(getFactsContract('cv.facts.v999'))).toBe(true)
  })

  test('produces strict JSON Schema for compiler and authoring tooling', () => {
    const jsonSchema = Schema.toJsonSchemaDocument(FactsCatalogueV1Schema)
    const serialized = JSON.stringify(jsonSchema)

    expect(serialized).toContain('"cv.facts.v1"')
    expect(serialized).toContain('"additionalProperties":false')
    expect(serialized).toContain('"claimIds"')
    expect(serialized).toContain('"sha256"')
  })
})
