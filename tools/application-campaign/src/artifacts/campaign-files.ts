import type { CampaignRecommendation } from '../ai/schema'
import type { CampaignMaterialsMode } from '../config/model'
import type { JobSource } from '../job'
import type { CampaignIssue, RoutineStep } from '../workflow/routine'
import type { CampaignDecisions, GeneratedCampaign } from '../workflow/types'
import { line } from './files'

export const requiredArtifactFileNames = [
  'application.json',
  'job.md',
  'recommendation.json',
  'recommendation.md',
]
const materialArtifactFileNames = ['cover-letter.md', 'email.md']
export const artifactManifestFileName = 'artifact-manifest.json'
export const knownManagedArtifactFileNames = [
  ...requiredArtifactFileNames,
  ...materialArtifactFileNames,
  'link.txt',
  'pdf-path.txt',
  artifactManifestFileName,
]

export type CampaignArtifactFile = {
  readonly content: string
  readonly path: string
}

export type CampaignArtifactManifest = {
  readonly files: readonly string[]
  readonly generatedAt: string
  readonly version: 1
}

export type WriteCampaignArtifactsInput = {
  readonly decisions: CampaignDecisions
  readonly extensions?: Readonly<Record<string, unknown>>
  readonly generated?: GeneratedCampaign
  readonly issues?: readonly CampaignIssue[]
  readonly job: JobSource
  readonly materialsMode: CampaignMaterialsMode
  readonly outDir: string
  readonly recommendation: CampaignRecommendation
  readonly runId: string
  readonly routineSteps?: readonly RoutineStep<unknown>[]
  readonly status: 'partial' | 'succeeded'
}

export type RecommendationMarkdownContext = CampaignRecommendation & {
  readonly matchedEvidence: readonly (CampaignRecommendation['matchedEvidence'][number] & {
    readonly evidenceText: string
  })[]
  readonly recommendation: CampaignRecommendation['recommendation'] & {
    readonly confidencePercent: number
  }
}

export const recommendationMarkdownContext = (
  recommendation: CampaignRecommendation
): RecommendationMarkdownContext => ({
  ...recommendation,
  matchedEvidence: recommendation.matchedEvidence.map((item) => ({
    ...item,
    evidenceText: item.evidence.join('; '),
  })),
  recommendation: {
    ...recommendation.recommendation,
    confidencePercent: Math.round(
      recommendation.recommendation.confidence * 100
    ),
  },
})

export type JobMarkdownContext = JobSource & {
  readonly contentType: string
}

export const jobMarkdownContext = (job: JobSource): JobMarkdownContext => ({
  ...job,
  contentType: job.contentType ?? 'unknown',
})

const json = (value: unknown) => line(JSON.stringify(value, null, 2))

type CampaignMessage = CampaignRecommendation['email']

const messageMarkdown = (label: string, message: CampaignMessage) =>
  [
    `# ${label}`,
    ...(message.subject ? [`Subject: ${message.subject}`] : []),
    message.body,
  ]
    .filter((block) => block.trim())
    .join('\n\n')

export type BuildCampaignArtifactFilesInput = {
  readonly input: WriteCampaignArtifactsInput
  readonly jobMarkdown: string
  readonly recommendationMarkdown: string
}

export const buildCampaignArtifactFiles = ({
  input,
  jobMarkdown,
  recommendationMarkdown,
}: BuildCampaignArtifactFilesInput): readonly CampaignArtifactFile[] => {
  const {
    decisions,
    extensions,
    generated,
    issues = [],
    job,
    materialsMode,
    recommendation,
    runId,
    routineSteps = [],
    status,
  } = input

  return [
    { content: jobMarkdown, path: 'job.md' },
    { content: json(recommendation), path: 'recommendation.json' },
    { content: recommendationMarkdown, path: 'recommendation.md' },
    ...(materialsMode === 'all'
      ? [
          {
            content: messageMarkdown(
              'Cover letter',
              recommendation.coverLetter
            ),
            path: 'cover-letter.md',
          },
          {
            content: messageMarkdown('Application email', recommendation.email),
            path: 'email.md',
          },
        ]
      : []),
    {
      content: json({
        decisions,
        extensions: extensions ?? {},
        generated: generated ?? {},
        issues,
        job: { url: job.url },
        materials: { mode: materialsMode },
        routine: { steps: routineSteps },
        recommendation: {
          confidence: recommendation.recommendation.confidence,
          profile: recommendation.recommendation.profile,
        },
        runId,
        status,
      }),
      path: 'application.json',
    },
    ...(generated?.link
      ? [{ content: line(generated.link.url), path: 'link.txt' }]
      : []),
    ...(generated?.pdfPath
      ? [{ content: line(generated.pdfPath), path: 'pdf-path.txt' }]
      : []),
  ]
}

export const manifestArtifactFile = (manifest: CampaignArtifactManifest) => ({
  content: json(manifest),
  path: artifactManifestFileName,
})
