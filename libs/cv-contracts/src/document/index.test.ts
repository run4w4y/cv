import { describe, expect, test } from 'bun:test'
import { Option, Schema } from 'effect'
import {
  CvDocumentV1Schema,
  CvPersonV1Schema,
  cvDocumentSchemaRegistry,
  cvDocumentV1ContractId,
  cvDocumentV1Version,
  getCvDocumentContract,
  getGenerationGuidance,
} from './index'

const validDocument = {
  $schema: 'cv.document.v1',
  locale: 'en',
  direction: 'ltr',
  person: {
    name: 'Ada Lovelace',
    headline: 'Software engineer',
    location: 'London, United Kingdom',
    summary:
      'Builds dependable software systems with a focus on clear reasoning.',
    contacts: [
      {
        kind: 'email',
        label: 'Email',
        value: 'ada@example.test',
        href: 'mailto:ada@example.test',
      },
    ],
  },
  experience: [
    {
      id: 'experience.analytical-engine',
      company: 'Analytical Engines',
      role: 'Software engineer',
      period: '2023–present',
      highlights: ['Designed a verified computation pipeline.'],
      technologies: ['TypeScript', 'Effect'],
    },
  ],
  projects: [
    {
      id: 'project.notes',
      name: 'Notes engine',
      summary: 'A compact system for reproducible technical notes.',
      highlights: [],
      technologies: ['TypeScript'],
      links: [],
    },
  ],
  skills: [
    {
      id: 'skills.languages',
      label: 'Languages',
      items: ['TypeScript', 'SQL'],
    },
  ],
  education: [
    {
      id: 'education.mathematics',
      institution: 'University of London',
      qualification: 'Mathematics',
      period: '2019–2023',
      details: [],
    },
  ],
  additionalSections: [],
}

describe('cv.document.v1', () => {
  test('decodes the flattened one-page document shape', () => {
    const document = Schema.decodeUnknownSync(CvDocumentV1Schema)(validDocument)

    expect(document.$schema).toBe(cvDocumentV1ContractId)
    expect(document.person.name).toBe('Ada Lovelace')
    expect(document.experience[0]?.technologies).toEqual([
      'TypeScript',
      'Effect',
    ])
  })

  test('rejects an unsupported contract version and unknown root fields', () => {
    expect(() =>
      Schema.decodeUnknownSync(CvDocumentV1Schema)({
        ...validDocument,
        $schema: 'cv.document.v2',
      })
    ).toThrow()

    expect(() =>
      Schema.decodeUnknownSync(CvDocumentV1Schema)({
        ...validDocument,
        rendererTheme: 'private-renderer-detail',
      })
    ).toThrow()

    expect(() =>
      Schema.decodeUnknownSync(CvDocumentV1Schema)({
        ...validDocument,
        person: { ...validDocument.person, headline: ' untrimmed ' },
      })
    ).toThrow()

    expect(
      Schema.decodeUnknownSync(CvDocumentV1Schema)({
        ...validDocument,
        locale: 'en-GB',
      }).locale
    ).toBe('en-GB')
  })

  test('rejects duplicate stable IDs with a field-local issue', () => {
    expect(() =>
      Schema.decodeUnknownSync(CvDocumentV1Schema)({
        ...validDocument,
        experience: [validDocument.experience[0], validDocument.experience[0]],
      })
    ).toThrow('Duplicate item identifier')
  })

  test('exposes model guidance through Effect annotations', () => {
    const guidance = getGenerationGuidance(CvPersonV1Schema.fields.summary)

    expect(Option.isSome(guidance)).toBeTrue()
    if (Option.isSome(guidance)) {
      expect(guidance.value.sources).toContain('trusted-facts')
      expect(guidance.value.sources).toContain('job-context')
      expect(guidance.value.maxWords).toBe(90)
    }
  })

  test('registers the immutable contract ID and version', () => {
    expect(cvDocumentSchemaRegistry).toHaveLength(1)
    expect(cvDocumentSchemaRegistry[0]?.version).toBe(cvDocumentV1Version)
    expect(Option.isSome(getCvDocumentContract(cvDocumentV1ContractId))).toBe(
      true
    )
    expect(Option.isNone(getCvDocumentContract('cv.document.v999'))).toBe(true)
  })

  test('produces strict JSON Schema with optional guidance metadata', () => {
    const jsonSchema = Schema.toJsonSchemaDocument(CvDocumentV1Schema, {
      includeAnnotationKey: (key) => key === 'generationGuidance',
    })
    const serialized = JSON.stringify(jsonSchema)

    expect(jsonSchema.dialect).toBe('draft-2020-12')
    expect(serialized).toContain('"additionalProperties":false')
    expect(serialized).toContain('"cv.document.v1"')
    expect(serialized).toContain('"generationGuidance"')
    expect(serialized).toContain('Tailor the headline')
    expect(serialized).toContain('Write a compact opening')
    expect(serialized).toContain('"maxItems":10')
  })
})
