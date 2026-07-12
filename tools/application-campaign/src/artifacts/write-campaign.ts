import { DateTime, Effect } from 'effect'
import { logDebug, logInfo, withTelemetrySpan } from '../telemetry'
import { renderTemplate } from '../template'
import {
  artifactManifestFileName,
  buildCampaignArtifactFiles,
  type CampaignArtifactManifest,
  jobMarkdownContext,
  knownManagedArtifactFileNames,
  manifestArtifactFile,
  recommendationMarkdownContext,
  requiredArtifactFileNames,
  type WriteCampaignArtifactsInput,
} from './campaign-files'
import { replaceManagedFilesAtomically } from './files'

export type {
  BuildCampaignArtifactFilesInput,
  CampaignArtifactFile,
  CampaignArtifactManifest,
  WriteCampaignArtifactsInput,
} from './campaign-files'
export { buildCampaignArtifactFiles } from './campaign-files'

const jobArtifactTemplateName = 'job.md.hbs'
const recommendationArtifactTemplateName = 'recommendation.md.hbs'

export const writeCampaignArtifacts = (input: WriteCampaignArtifactsInput) =>
  Effect.gen(function* () {
    const {
      generated,
      issues = [],
      job,
      materialsMode,
      outDir,
      recommendation,
    } = input
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
    const files = buildCampaignArtifactFiles({
      input,
      jobMarkdown,
      recommendationMarkdown,
    })

    yield* logInfo('Writing campaign artifacts', {
      fileCount: files.length,
      hasPrivateLink: Boolean(generated?.link),
      hasPrivatePdf: Boolean(generated?.pdfPath),
      materialsMode,
      outDir,
      warningCount: issues.filter((issue) => issue.severity === 'warning')
        .length,
    })
    const manifest: CampaignArtifactManifest = {
      files: files.map((file) => file.path),
      generatedAt: DateTime.formatIso(yield* DateTime.now),
      version: 1,
    }

    yield* replaceManagedFilesAtomically({
      files: [...files, manifestArtifactFile(manifest)],
      knownManagedFiles: knownManagedArtifactFileNames,
      manifestFileName: artifactManifestFileName,
      outDir,
    })
    yield* logDebug('Wrote campaign artifact files', {
      files: files.map((file) => file.path).join(', '),
      outDir,
    })
    yield* logInfo('Finished writing campaign artifacts', {
      fileCount: files.length,
      outDir,
    })

    return manifest
  }).pipe(
    withTelemetrySpan('application-campaign.artifacts.write', {
      fileCount: requiredArtifactFileNames.length,
      outDir: input.outDir,
    })
  )
