import { Schema } from 'effect'

import {
  ContactItemSourceSchema,
  ContactSectionSourceSchema,
  EducationEntrySourceSchema,
  EducationSectionSourceSchema,
  EducationThesisSourceSchema,
  ExperienceEntrySourceSchema,
  ExperienceSectionSourceSchema,
  ExperienceWorkstreamSourceSchema,
  FactAssetRegistrySourceSchema,
  FactAssetSourceSchema,
  FactEvidenceRegistrySourceSchema,
  FactEvidenceSourceSchema,
  FactLinkSourceSchema,
  FactsRepositoryConfigSourceSchema,
  FactTailoringGuidanceSourceSchema,
  IdentityLanguageSourceSchema,
  IdentitySectionSourceSchema,
  ProjectContributionSourceSchema,
  ProjectEntrySourceSchema,
  ProjectsSectionSourceSchema,
  ReviewedFactSourceSchema,
  SkillEntrySourceSchema,
  SkillGroupSourceSchema,
  SkillsSectionSourceSchema,
} from './schema'

const portableReferenceNames: Readonly<Record<string, string>> = {
  ContactSectionSource: 'ContactSection',
  EducationSectionSource: 'EducationSection',
  ExperienceSectionSource: 'ExperienceSection',
  FactAssetSource: 'FactAsset',
  FactEvidenceSource: 'FactEvidence',
  FactTailoringGuidanceV1: 'FactTailoringGuidance',
  IdentitySectionSource: 'IdentitySection',
  ProjectsSectionSource: 'ProjectsSection',
  ReviewedFactSource: 'ReviewedFact',
  SkillsSectionSource: 'SkillsSection',
}

const record = (value: unknown): Readonly<Record<string, unknown>> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null

const literal = (value: unknown) =>
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean' ||
  value === null
    ? JSON.stringify(value)
    : 'unknown'

const referenceIdentifier = (reference: string) =>
  reference.startsWith('#/$defs/')
    ? decodeURIComponent(reference.slice('#/$defs/'.length))
    : null

const propertyName = (value: string) =>
  /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(value) ? value : JSON.stringify(value)

const renderSchema = (
  value: unknown,
  definitions: Readonly<Record<string, unknown>>,
  inlineReference: string | null = null
): string => {
  if (value === true) return 'unknown'
  if (value === false) return 'never'
  const schema = record(value)
  if (schema === null) return 'unknown'

  if (typeof schema.$ref === 'string') {
    const identifier = referenceIdentifier(schema.$ref)
    if (identifier === null) return 'unknown'
    if (identifier !== inlineReference) {
      const portableName = portableReferenceNames[identifier]
      if (portableName !== undefined) return portableName
    }
    return renderSchema(definitions[identifier], definitions, identifier)
  }

  if (Array.isArray(schema.enum)) {
    return schema.enum.map(literal).join(' | ')
  }
  if ('const' in schema) return literal(schema.const)

  const variants = Array.isArray(schema.anyOf)
    ? schema.anyOf
    : Array.isArray(schema.oneOf)
      ? schema.oneOf
      : null
  if (variants !== null) {
    return variants
      .map((variant) => renderSchema(variant, definitions))
      .join(' | ')
  }

  if (schema.type === 'array') {
    return `ReadonlyArray<${renderSchema(schema.items, definitions)}>`
  }

  if (schema.type === 'object' || schema.properties !== undefined) {
    const properties = record(schema.properties) ?? {}
    const patternProperties = record(schema.patternProperties)
    const required = new Set(
      Array.isArray(schema.required)
        ? schema.required.filter(
            (item): item is string => typeof item === 'string'
          )
        : []
    )
    if (
      Object.keys(properties).length === 0 &&
      patternProperties !== null &&
      Object.keys(patternProperties).length > 0
    ) {
      const valueSchema = Object.values(patternProperties)[0]
      return `Readonly<Record<string, ${renderSchema(valueSchema, definitions)}>>`
    }
    if (
      Object.keys(properties).length === 0 &&
      schema.additionalProperties !== undefined &&
      schema.additionalProperties !== false
    ) {
      return `Readonly<Record<string, ${renderSchema(schema.additionalProperties, definitions)}>>`
    }
    const fields = Object.entries(properties).map(
      ([name, property]) =>
        `readonly ${propertyName(name)}${required.has(name) ? '' : '?'}: ${renderSchema(property, definitions)}`
    )
    return fields.length === 0 ? '{}' : `{\n${fields.join('\n')}\n}`
  }

  if (schema.type === 'string') return 'string'
  if (schema.type === 'number' || schema.type === 'integer') return 'number'
  if (schema.type === 'boolean') return 'boolean'
  if (schema.type === 'null') return 'null'

  if (Array.isArray(schema.allOf)) {
    const rendered = schema.allOf
      .map((member) => renderSchema(member, definitions))
      .filter((member) => member !== 'unknown')
    return rendered.length === 0 ? 'unknown' : rendered.join(' & ')
  }

  return 'unknown'
}

const portableType = (name: string, schema: Schema.Top) => {
  const document = Schema.toJsonSchemaDocument(schema)
  const rootReference = record(document.schema)?.$ref
  const inlineReference =
    typeof rootReference === 'string'
      ? referenceIdentifier(rootReference)
      : null
  return `export type ${name} = ${renderSchema(
    document.schema,
    document.definitions,
    inlineReference
  )}`
}

const portableSchemas: ReadonlyArray<readonly [string, Schema.Top]> = [
  ['FactsRepositoryConfig', FactsRepositoryConfigSourceSchema],
  ['FactTailoringGuidance', FactTailoringGuidanceSourceSchema],
  ['ReviewedFact', ReviewedFactSourceSchema],
  ['FactLink', FactLinkSourceSchema],
  ['FactEvidence', FactEvidenceSourceSchema],
  ['FactEvidenceRegistry', FactEvidenceRegistrySourceSchema],
  ['FactAsset', FactAssetSourceSchema],
  ['FactAssetRegistry', FactAssetRegistrySourceSchema],
  ['IdentityLanguage', IdentityLanguageSourceSchema],
  ['IdentitySection', IdentitySectionSourceSchema],
  ['ContactItem', ContactItemSourceSchema],
  ['ContactSection', ContactSectionSourceSchema],
  ['EducationThesis', EducationThesisSourceSchema],
  ['EducationEntry', EducationEntrySourceSchema],
  ['EducationSection', EducationSectionSourceSchema],
  ['ExperienceWorkstream', ExperienceWorkstreamSourceSchema],
  ['ExperienceEntry', ExperienceEntrySourceSchema],
  ['ExperienceSection', ExperienceSectionSourceSchema],
  ['ProjectContribution', ProjectContributionSourceSchema],
  ['ProjectEntry', ProjectEntrySourceSchema],
  ['ProjectsSection', ProjectsSectionSourceSchema],
  ['SkillEntry', SkillEntrySourceSchema],
  ['SkillGroup', SkillGroupSourceSchema],
  ['SkillsSection', SkillsSectionSourceSchema],
]

export const renderFactsAuthoringDeclarations = (): string => {
  const declarations = portableSchemas.map(([name, schema]) =>
    portableType(name, schema)
  )
  return `// Generated from the authoritative cv facts schemas. Do not edit by hand.
// Regenerate this file with the facts-types tool from run4w4y/cv.

declare module 'virtual:facts' {
${declarations.join('\n\n')}
}
`
}
