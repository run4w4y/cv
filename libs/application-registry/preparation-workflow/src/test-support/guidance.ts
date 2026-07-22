import {
  type CvFieldGenerationGuidanceV1,
  type CvGenerationGuidanceV1,
  cvGenerationGuidanceFieldTargetValues,
} from '@cv/contracts/document'

const field = (
  target: CvFieldGenerationGuidanceV1['target']
): CvFieldGenerationGuidanceV1 => ({
  instruction: `Write ${target} from reviewed facts.`,
  sources: ['trusted-facts'],
  target,
})

export const cvGenerationGuidanceTestFixture: CvGenerationGuidanceV1 = {
  $schema: 'cv.generation-guidance.v1',
  documentContract: 'cv.document.v1',
  fields: cvGenerationGuidanceFieldTargetValues.map(field),
  instruction: 'Produce a truthful CV from reviewed facts.',
  label: 'Test CV guidance',
  rules: ['Do not invent claims.'],
  sources: ['trusted-facts', 'job-context'],
}
