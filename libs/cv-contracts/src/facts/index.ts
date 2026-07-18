import { Option, Schema } from 'effect'
import {
  type GenerationGuidance,
  GenerationGuidanceAnnotationId,
} from '../guidance'
import {
  CvLocaleSchema,
  NonEmptyTextSchema,
  Sha256HexSchema,
  ShortTextSchema,
  StableIdentifierSchema,
  UriSchema,
} from '../internal/primitives'

export {
  type GenerationGuidance,
  GenerationGuidanceAnnotationId,
  type GenerationGuidanceSource,
  generationGuidanceSourceValues,
  getGenerationGuidance,
} from '../guidance'

export const cvFactsV1ContractId = 'cv.facts.v1' as const
export const cvFactsV1Version = 1 as const

export const cvFactsV1AuthoringGuidance = {
  instruction:
    'Publish only human-reviewed statements and wording presets that are safe to present as truth. Stable IDs are permanent references and must retain their meaning across releases.',
  sources: ['human-reviewed'],
  rules: [
    'Write each claim so that it is understandable without relying on an object shape known to the backend.',
    'Keep objective facts separate from approved wording presets.',
    'Every wording preset must cite the claim IDs that authorize its factual content.',
    'Changing the meaning of an existing ID is forbidden; introduce a new ID instead.',
    'Evidence helps human review but is never sent to the public renderer unless deliberately selected into document content.',
  ],
} as const satisfies GenerationGuidance & {
  readonly rules: ReadonlyArray<string>
}

const FactTagSchema = StableIdentifierSchema.annotate({
  title: 'Tag',
  description:
    'Optional stable tag used to find and rank relevant facts without changing their meaning.',
})

export const FactEvidenceV1Schema = Schema.Struct({
  kind: Schema.Literals([
    'primary-source',
    'public-source',
    'private-source',
    'personal-review',
  ]).annotate({
    title: 'Evidence kind',
    description: 'Human-review classification for this evidence.',
  }),
  label: ShortTextSchema.annotate({
    title: 'Evidence label',
    description: 'Short description of the supporting material.',
  }),
  uri: Schema.optional(
    UriSchema.annotate({
      title: 'Evidence URI',
      description: 'Optional absolute URI for supporting material.',
    })
  ),
  note: Schema.optional(
    NonEmptyTextSchema.pipe(Schema.check(Schema.isMaxLength(1_000))).annotate({
      title: 'Review note',
      description: 'Private context that helps a human verify the claim.',
    })
  ),
}).annotate({
  identifier: 'FactEvidenceV1',
  title: 'Fact evidence',
})

export type FactEvidenceV1 = Schema.Schema.Type<typeof FactEvidenceV1Schema>

export const FactClaimV1Schema = Schema.Struct({
  id: StableIdentifierSchema.annotate({
    title: 'Claim ID',
    description: 'Permanent stable identifier for this claim.',
    [GenerationGuidanceAnnotationId]: {
      instruction:
        'Choose a durable semantic ID. Never reuse an existing ID for a different claim.',
      sources: ['human-reviewed'],
    } satisfies GenerationGuidance,
  }),
  status: Schema.Literal('approved').annotate({
    title: 'Approval status',
    description: 'Only approved claims may enter a facts release.',
  }),
  topic: StableIdentifierSchema.annotate({
    title: 'Topic',
    description:
      'Open-ended grouping such as identity, contact, employment, project, education, or skill.',
  }),
  statement: NonEmptyTextSchema.pipe(
    Schema.check(Schema.isMaxLength(2_000))
  ).annotate({
    title: 'Canonical statement',
    description:
      'Self-contained statement of the reviewed fact in the catalogue locale.',
    [GenerationGuidanceAnnotationId]: {
      instruction:
        'State only what a human has verified. Include enough context that a model cannot reasonably misinterpret the claim.',
      sources: ['human-reviewed'],
    } satisfies GenerationGuidance,
  }),
  tags: Schema.Array(FactTagSchema).pipe(Schema.check(Schema.isMaxLength(32))),
  evidence: Schema.Array(FactEvidenceV1Schema).pipe(
    Schema.check(Schema.isMaxLength(12))
  ),
}).annotate({
  identifier: 'FactClaimV1',
  title: 'Approved fact claim',
  description: 'One atomic, human-reviewed statement that may ground CV copy.',
})

export type FactClaimV1 = Schema.Schema.Type<typeof FactClaimV1Schema>

export const FactWordingPresetV1Schema = Schema.Struct({
  id: StableIdentifierSchema.annotate({
    title: 'Preset ID',
    description: 'Permanent stable identifier for this wording preset.',
  }),
  status: Schema.Literal('approved').annotate({
    title: 'Approval status',
    description: 'Only approved wording may enter a facts release.',
  }),
  purpose: StableIdentifierSchema.annotate({
    title: 'Purpose',
    description:
      'Open-ended use such as summary, experience-highlight, project-summary, or cover-letter.',
  }),
  text: NonEmptyTextSchema.pipe(
    Schema.check(Schema.isMaxLength(3_000))
  ).annotate({
    title: 'Approved wording',
    description:
      'Human-reviewed phrasing that may be used verbatim or faithfully shortened.',
    [GenerationGuidanceAnnotationId]: {
      instruction:
        'Preserve the meaning and every factual quantity. Tailoring may shorten or select this text, not add new claims.',
      sources: ['human-reviewed'],
    } satisfies GenerationGuidance,
  }),
  claimIds: Schema.Array(StableIdentifierSchema).pipe(
    Schema.check(Schema.isMinLength(1)),
    Schema.check(Schema.isMaxLength(64))
  ),
  tags: Schema.Array(FactTagSchema).pipe(Schema.check(Schema.isMaxLength(32))),
}).annotate({
  identifier: 'FactWordingPresetV1',
  title: 'Approved wording preset',
  description:
    'Reviewed phrasing whose factual content is authorized by explicit claim references.',
})

export type FactWordingPresetV1 = Schema.Schema.Type<
  typeof FactWordingPresetV1Schema
>

export const FactAssetV1Schema = Schema.Struct({
  id: StableIdentifierSchema.annotate({
    title: 'Asset ID',
    description:
      'Stable identifier resolved to an immutable object by the facts release manifest.',
  }),
  label: ShortTextSchema.annotate({ title: 'Asset label' }),
  description: NonEmptyTextSchema.pipe(
    Schema.check(Schema.isMaxLength(1_000))
  ).annotate({
    title: 'Asset description',
    description: 'Human-readable explanation of the supporting asset.',
  }),
  mediaType: Schema.String.pipe(
    Schema.check(
      Schema.isPattern(
        /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+(?:\s*;\s*[^\s=]+=[^;]+)*$/iu
      )
    )
  ).annotate({
    title: 'Media type',
    description: 'IANA-style media type for the asset.',
  }),
  sha256: Sha256HexSchema.annotate({
    title: 'Asset SHA-256',
    description:
      'Digest verified by the facts compiler before the release is accepted.',
  }),
  claimIds: Schema.Array(StableIdentifierSchema).pipe(
    Schema.check(Schema.isMaxLength(64))
  ),
}).annotate({
  identifier: 'FactAssetV1',
  title: 'Facts asset',
  description:
    'Metadata for an immutable supporting asset included in a facts release.',
})

export type FactAssetV1 = Schema.Schema.Type<typeof FactAssetV1Schema>

export const FactsCatalogueV1StructureSchema = Schema.Struct({
  $schema: Schema.Literal(cvFactsV1ContractId).annotate({
    title: 'Contract ID',
    description: 'Immutable identifier of the facts contract version.',
  }),
  locale: CvLocaleSchema.annotate({
    title: 'Locale',
    description: 'Single locale used for every claim and preset in this file.',
  }),
  claims: Schema.Array(FactClaimV1Schema).pipe(
    Schema.check(Schema.isMinLength(1))
  ),
  presets: Schema.Array(FactWordingPresetV1Schema),
  assets: Schema.Array(FactAssetV1Schema),
})

export type FactsCatalogueV1Structure = Schema.Schema.Type<
  typeof FactsCatalogueV1StructureSchema
>

const duplicateIdentifierIssues = (
  items: ReadonlyArray<{ readonly id: string }>,
  collection: 'claims' | 'presets' | 'assets'
): ReadonlyArray<Schema.FilterIssue> => {
  const seen = new Set<string>()
  return items.flatMap((item, index) => {
    if (seen.has(item.id)) {
      return [
        {
          path: [collection, index, 'id'],
          issue: `Duplicate ${collection} identifier: ${item.id}`,
        },
      ]
    }
    seen.add(item.id)
    return []
  })
}

const missingClaimReferenceIssues = (
  catalogue: FactsCatalogueV1Structure
): ReadonlyArray<Schema.FilterIssue> => {
  const claimIds = new Set(catalogue.claims.map((claim) => claim.id))
  const presetIssues = catalogue.presets.flatMap((preset, presetIndex) =>
    preset.claimIds.flatMap((claimId, claimIndex) =>
      claimIds.has(claimId)
        ? []
        : [
            {
              path: ['presets', presetIndex, 'claimIds', claimIndex],
              issue: `Unknown claim reference: ${claimId}`,
            },
          ]
    )
  )
  const assetIssues = catalogue.assets.flatMap((asset, assetIndex) =>
    asset.claimIds.flatMap((claimId, claimIndex) =>
      claimIds.has(claimId)
        ? []
        : [
            {
              path: ['assets', assetIndex, 'claimIds', claimIndex],
              issue: `Unknown claim reference: ${claimId}`,
            },
          ]
    )
  )
  return [...presetIssues, ...assetIssues]
}

export const inspectFactsCatalogueV1Integrity = (
  catalogue: FactsCatalogueV1Structure
): ReadonlyArray<Schema.FilterIssue> => [
  ...duplicateIdentifierIssues(catalogue.claims, 'claims'),
  ...duplicateIdentifierIssues(catalogue.presets, 'presets'),
  ...duplicateIdentifierIssues(catalogue.assets, 'assets'),
  ...missingClaimReferenceIssues(catalogue),
]

export const FactsCatalogueV1Schema = FactsCatalogueV1StructureSchema.pipe(
  Schema.check(
    Schema.makeFilter(inspectFactsCatalogueV1Integrity, {
      description:
        'A facts catalogue with unique stable IDs and valid claim references.',
    })
  )
).annotate({
  identifier: 'FactsCatalogueV1',
  title: 'CV facts catalogue v1',
  description:
    'A single-locale catalogue of approved claims, wording presets, and supporting assets.',
  parseOptions: { errors: 'all', onExcessProperty: 'error' },
  [GenerationGuidanceAnnotationId]: cvFactsV1AuthoringGuidance,
})

export type FactsCatalogueV1 = Schema.Schema.Type<typeof FactsCatalogueV1Schema>
export type FactsCatalogueV1Encoded = Schema.Codec.Encoded<
  typeof FactsCatalogueV1Schema
>

export const FactsCatalogueSchema = FactsCatalogueV1Schema
export type FactsCatalogue = Schema.Schema.Type<typeof FactsCatalogueSchema>

export const factsSchemaRegistry = [
  {
    contractId: cvFactsV1ContractId,
    version: cvFactsV1Version,
    schema: FactsCatalogueV1Schema,
    authoringGuidance: cvFactsV1AuthoringGuidance,
  },
] as const

export type FactsContractId = (typeof factsSchemaRegistry)[number]['contractId']

export const getFactsContract = (contractId: string) =>
  contractId === cvFactsV1ContractId
    ? Option.some(factsSchemaRegistry[0])
    : Option.none()
