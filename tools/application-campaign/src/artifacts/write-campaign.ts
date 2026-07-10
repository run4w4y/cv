import { Effect } from 'effect'
import { Path } from 'effect/Path'
import type { CampaignRecommendation } from '../ai/schema'
import type { CampaignMaterialsMode } from '../config/model'
import type { JobSource } from '../job'
import { logDebug, logInfo, withTelemetrySpan } from '../telemetry'
import { renderTemplate } from '../template'
import type { CampaignIssue, RoutineStep } from '../workflow/routine'
import type { GeneratedCampaign } from '../workflow/types'
import { ensureDirectory, line, writeJson, writeText } from './files'

const jobArtifactTemplateName = 'job.md.hbs'
const recommendationArtifactTemplateName = 'recommendation.md.hbs'
const requiredArtifactFileNames = [
  'application.json',
  'job.md',
  'recommendation.json',
  'recommendation.md',
]
const materialArtifactFileNames = ['cover-letter.md', 'email.md']

type RecommendationMarkdownContext = CampaignRecommendation & {
  readonly matchedEvidence: readonly (CampaignRecommendation['matchedEvidence'][number] & {
    readonly evidenceText: string
  })[]
  readonly recommendation: CampaignRecommendation['recommendation'] & {
    readonly confidencePercent: number
  }
}

const recommendationMarkdownContext = (
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

type JobMarkdownContext = JobSource & {
  readonly contentType: string
}

const jobMarkdownContext = (job: JobSource): JobMarkdownContext => ({
  ...job,
  contentType: job.contentType ?? 'unknown',
})

const artifactFileNames = ({
  generated,
  materialsMode,
}: {
  readonly generated?: GeneratedCampaign
  readonly materialsMode: CampaignMaterialsMode
}) => [
  ...requiredArtifactFileNames,
  ...(materialsMode === 'all' ? materialArtifactFileNames : []),
  ...(generated?.link ? ['link.txt'] : []),
  ...(generated?.pdfPath ? ['pdf-path.txt'] : []),
]

export const writeCampaignArtifacts = ({
  decisions,
  generated,
  issues = [],
  job,
  materialsMode,
  outDir,
  recommendation,
  routineSteps = [],
  status,
}: {
  readonly decisions: {
    readonly audience: string
    readonly profile: string
  }
  readonly generated?: GeneratedCampaign
  readonly issues?: readonly CampaignIssue[]
  readonly job: JobSource
  readonly materialsMode: CampaignMaterialsMode
  readonly outDir: string
  readonly routineSteps?: readonly RoutineStep<unknown>[]
  readonly recommendation: CampaignRecommendation
  readonly status: 'partial' | 'succeeded'
}) =>
  Effect.gen(function* () {
    const path = yield* Path
    const fileNames = artifactFileNames({ generated, materialsMode })

    yield* logInfo('Writing campaign artifacts', {
      fileCount: fileNames.length,
      hasPrivateLink: Boolean(generated?.link),
      hasPrivatePdf: Boolean(generated?.pdfPath),
      materialsMode,
      outDir,
      warningCount: issues.filter((issue) => issue.severity === 'warning')
        .length,
    })

    yield* ensureDirectory(outDir, 'Could not create campaign output directory')
    const jobMarkdown = yield* renderTemplate({
      context: jobMarkdownContext(job),
      purpose: 'artifact',
      templateName: jobArtifactTemplateName,
    })
    const recommendationMarkdown = yield* renderTemplate({
      context: recommendationMarkdownContext(recommendation),
      purpose: 'artifact',
      templateName: recommendationArtifactTemplateName,
    })

    yield* Effect.all(
      [
        writeText(path.join(outDir, 'job.md'), jobMarkdown),
        writeJson(path.join(outDir, 'recommendation.json'), recommendation),
        writeText(
          path.join(outDir, 'recommendation.md'),
          recommendationMarkdown
        ),
        ...(materialsMode === 'all'
          ? [
              writeText(
                path.join(outDir, 'cover-letter.md'),
                recommendation.coverLetter.body
              ),
              writeText(
                path.join(outDir, 'email.md'),
                recommendation.email.body
              ),
            ]
          : []),
        writeJson(path.join(outDir, 'application.json'), {
          decisions,
          generated: generated ?? {},
          issues,
          job: {
            url: job.url,
          },
          materials: {
            mode: materialsMode,
          },
          routine: {
            steps: routineSteps,
          },
          recommendation: {
            confidence: recommendation.recommendation.confidence,
            profile: recommendation.recommendation.profile,
          },
          status,
        }),
      ],
      { concurrency: 'unbounded', discard: true }
    )

    if (generated?.link) {
      yield* writeText(path.join(outDir, 'link.txt'), line(generated.link.url))
    }

    if (generated?.pdfPath) {
      yield* writeText(
        path.join(outDir, 'pdf-path.txt'),
        line(generated.pdfPath)
      )
    }

    yield* logDebug('Wrote campaign artifact files', {
      files: fileNames.join(', '),
      outDir,
    })
    yield* logInfo('Finished writing campaign artifacts', {
      fileCount: fileNames.length,
      outDir,
    })
  }).pipe(
    withTelemetrySpan('application-campaign.artifacts.write', {
      fileCount: artifactFileNames({ generated, materialsMode }).length,
      outDir,
    })
  )
