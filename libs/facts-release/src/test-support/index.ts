import type { CvGenerationGuidanceV1 } from '@cv/contracts/document'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import type { FactsReleaseProvenance } from '../model'

export const fixtureAssetBytes = new TextEncoder().encode(
  'reviewed supporting material'
)

export const fixtureProvenance: FactsReleaseProvenance = {
  compiler: {
    commit: 'b'.repeat(40),
    repository: 'cv',
  },
  source: {
    commit: 'a'.repeat(40),
    repository: 'cv-content',
  },
}

const guidanceField = (
  target: CvGenerationGuidanceV1['fields'][number]['target']
): CvGenerationGuidanceV1['fields'][number] => ({
  instruction: `Write ${target} from reviewed facts.`,
  sources: ['trusted-facts'],
  target,
})

export const cvGenerationGuidanceFixture: CvGenerationGuidanceV1 = {
  $schema: 'cv.generation-guidance.v1',
  documentContract: 'cv.document.v1',
  fields: [
    guidanceField('document.locale'),
    guidanceField('document.direction'),
    guidanceField('person.name'),
    guidanceField('person.headline'),
    guidanceField('person.location'),
    guidanceField('person.summary'),
    guidanceField('person.contacts.value'),
    guidanceField('person.contacts.href'),
    guidanceField('experience.company'),
    guidanceField('experience.role'),
    guidanceField('experience.period'),
    guidanceField('experience.location'),
    guidanceField('experience.summary'),
    guidanceField('experience.highlights'),
    guidanceField('experience.technologies'),
    guidanceField('projects.name'),
    guidanceField('projects.summary'),
    guidanceField('projects.highlights'),
    guidanceField('projects.technologies'),
    guidanceField('projects.links.value'),
    guidanceField('projects.links.href'),
    guidanceField('skills.label'),
    guidanceField('skills.items'),
    guidanceField('education.institution'),
    guidanceField('education.qualification'),
    guidanceField('education.period'),
    guidanceField('education.details'),
    guidanceField('additionalSections.items.text'),
  ],
  instruction: 'Produce a truthful CV from reviewed facts.',
  label: 'Reviewed CV guidance',
  rules: ['Do not invent claims.'],
  sources: ['trusted-facts', 'job-context'],
}

export const factsCatalogueFixture = (
  assetSha256: string,
  locale = 'en',
  statement = locale === 'ru'
    ? 'Работает инженером-программистом в Analytical Engines с 2023 года по настоящее время.'
    : 'Worked as a software engineer at Analytical Engines from 2023 to the present.'
) =>
  ({
    $schema: 'cv.facts.v1',
    assets: [
      {
        description: 'Reviewed supporting material for the employment claim.',
        id: 'asset.employment-review',
        label: 'Employment review',
        mediaType: 'application/pdf',
        sha256: assetSha256,
      },
    ],
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
        facts: [
          {
            evidenceIds: ['evidence.employment-history-review'],
            id: 'identity.employment-summary',
            text: statement,
          },
        ],
        languages: [],
      },
    ],
    locale,
  }) satisfies FactsCatalogueV1
