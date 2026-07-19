import { describe, expect, test } from 'bun:test'
import { Option, Schema } from 'effect'
import {
  cvFactsV1ContractId,
  cvFactsV1Version,
  FactsCatalogueV1Schema,
  FactsCatalogueV1StructureSchema,
  factsSchemaRegistry,
  getFactsContract,
  getGenerationGuidance,
  inspectFactsCatalogueV1Integrity,
  ReviewedFactV1Schema,
} from './index'

const validFact = {
  id: 'identity.employment-summary',
  text: 'Worked as a software engineer at Analytical Engines from 2023 to the present.',
  evidenceIds: ['evidence.employment-history-review'],
  assetIds: ['asset.bachelor-thesis'],
}

const validCatalogue = {
  $schema: 'cv.facts.v1',
  locale: 'en',
  evidence: [
    {
      id: 'evidence.employment-history-review',
      kind: 'personal-review',
      title: 'Reviewed employment history',
    },
  ],
  sections: [
    {
      kind: 'identity',
      name: 'Ada Lovelace',
      facts: [validFact],
      languages: [],
    },
  ],
  assets: [
    {
      id: 'asset.bachelor-thesis',
      label: 'Bachelor thesis',
      description: 'Reviewed bachelor thesis supporting the education claim.',
      mediaType: 'application/pdf',
      sha256: 'a'.repeat(64),
    },
  ],
}

describe('cv.facts.v1', () => {
  test('decodes a reviewed, single-locale facts catalogue', () => {
    const catalogue = Schema.decodeUnknownSync(FactsCatalogueV1Schema)(
      validCatalogue
    )

    expect(catalogue.$schema).toBe(cvFactsV1ContractId)
    const identity = catalogue.sections.find(
      (section) => section.kind === 'identity'
    )
    expect(
      identity?.kind === 'identity' ? identity.facts[0]?.evidenceIds : []
    ).toEqual(['evidence.employment-history-review'])
  })

  test('rejects authoring-only status fields and malformed values', () => {
    expect(() =>
      Schema.decodeUnknownSync(FactsCatalogueV1Schema)({
        ...validCatalogue,
        sections: [
          {
            ...validCatalogue.sections[0],
            facts: [
              {
                ...validCatalogue.sections[0].facts[0],
                status: 'draft',
              },
            ],
          },
        ],
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
        locale: 'not_a_locale',
      })
    ).toThrow()
  })

  test('reports duplicate fact IDs and dangling review references together', () => {
    const invalidCatalogue = {
      ...validCatalogue,
      sections: [
        {
          ...validCatalogue.sections[0],
          facts: [
            validFact,
            {
              ...validFact,
              evidenceIds: ['evidence.does-not-exist'],
              assetIds: ['asset.does-not-exist'],
            },
          ],
        },
      ],
    }
    const issues = inspectFactsCatalogueV1Integrity(
      Schema.decodeUnknownSync(FactsCatalogueV1StructureSchema)(
        invalidCatalogue
      )
    )

    expect(issues).toHaveLength(3)
    expect(() =>
      Schema.decodeUnknownSync(FactsCatalogueV1Schema)(invalidCatalogue)
    ).toThrow('Duplicate fact ID')
    expect(() =>
      Schema.decodeUnknownSync(FactsCatalogueV1Schema)(invalidCatalogue)
    ).toThrow('Unknown evidence reference')
  })

  test('exposes authoring guidance on factual statements', () => {
    const guidance = getGenerationGuidance(ReviewedFactV1Schema.fields.text)

    expect(Option.isSome(guidance)).toBe(true)
    if (Option.isSome(guidance)) {
      expect(guidance.value.sources).toEqual(['human-reviewed'])
      expect(guidance.value.instruction).toContain('reviewed')
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
    expect(serialized).toContain('"sections"')
    expect(serialized).toContain('"workstreams"')
    expect(serialized).toContain('"sha256"')
  })
})
