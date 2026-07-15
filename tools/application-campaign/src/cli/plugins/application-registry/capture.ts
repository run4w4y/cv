import {
  type ArtifactManifestEntry,
  normalizeApplicationCanonicalUrl,
  type OpportunityDetails,
} from '@cv/application-registry-entity'
import { type Context, type Crypto, DateTime, Effect, Encoding } from 'effect'
import { ApplicationCampaignValidationError } from '../../../errors'
import type {
  WorkflowFailurePolicy,
  WorkflowStep,
} from '../../../workflow/graph/types'
import {
  campaignRunIdKey,
  targetArtifactManifestKey,
  targetDecisionsKey,
  targetJobKey,
  targetPreparedCampaignKey,
} from '../../../workflow/keys'
import { campaignWorkflowStepIds } from '../../../workflow/step-ids'
import {
  applicationRegistryAnalysisResultKey,
  applicationRegistryFitAssessmentResultKey,
  isValidApplicationRegistryFitAssessment,
} from './analysis'
import type {
  ApplicationRegistryCampaignCaptureRequest,
  ApplicationRegistryCampaignClient,
} from './client'
import { applicationRegistryConflictResolutionsKey } from './conflicts'
import { applicationRegistrySyncStepId } from './sync'

const artifactMediaType = (path: string) => {
  if (path.endsWith('.json')) return 'application/json'
  if (path.endsWith('.md')) return 'text/markdown'
  if (path.endsWith('.txt')) return 'text/plain'
  return null
}

const campaignArtifacts = (
  files: readonly string[]
): readonly ArtifactManifestEntry[] =>
  ['artifact-manifest.json', ...files].map((path) => ({
    kind: path.replace(/\.[^.]+$/u, ''),
    mediaType: artifactMediaType(path),
    path,
    sha256: null,
  }))

const hasOpportunityDetails = ({
  languageRequirements,
  ...details
}: OpportunityDetails) =>
  languageRequirements.length > 0 ||
  Object.values(details).some((value) => value !== null)

export type MakeRegistryCaptureStepInput = {
  readonly client: ApplicationRegistryCampaignClient
  readonly crypto: Context.Service.Shape<typeof Crypto.Crypto>
  readonly deviceId: string | null
  readonly failurePolicy: WorkflowFailurePolicy
}

export const makeRegistryCaptureStep = ({
  client,
  crypto,
  deviceId,
  failurePolicy,
}: MakeRegistryCaptureStepInput): WorkflowStep => ({
  dependsOn: [
    applicationRegistrySyncStepId,
    campaignWorkflowStepIds.target.writeArtifacts,
  ],
  execute: ({ outputs }) =>
    Effect.gen(function* () {
      const [
        campaign,
        decisions,
        fitAssessment,
        job,
        manifest,
        runId,
        registryAnalysis,
      ] = yield* Effect.all([
        outputs.get(targetPreparedCampaignKey),
        outputs.get(targetDecisionsKey),
        outputs.get(applicationRegistryFitAssessmentResultKey),
        outputs.get(targetJobKey),
        outputs.get(targetArtifactManifestKey),
        outputs.get(campaignRunIdKey),
        outputs.get(applicationRegistryAnalysisResultKey),
      ])
      if (!isValidApplicationRegistryFitAssessment(fitAssessment)) {
        return yield* new ApplicationCampaignValidationError({
          message:
            'Application registry fit assessment dimensions must sum to fitScore.',
        })
      }
      const operationId = yield* crypto.randomUUIDv7
      const capturedAt = DateTime.formatIso(yield* DateTime.now)
      const canonicalUrl = normalizeApplicationCanonicalUrl(job.url)
      const conflictResolutions = yield* outputs.get(
        applicationRegistryConflictResolutionsKey
      )
      const targetResolution = conflictResolutions[canonicalUrl]
      if (targetResolution?.action === 'skip') return []
      const source = new URL(canonicalUrl).hostname
      const jobKey = `url:${canonicalUrl}`
      const contentHash = yield* crypto.digest(
        'SHA-256',
        new TextEncoder().encode(job.body)
      )
      const request = {
        applicationStatus: 'preparing',
        applicationUrl: registryAnalysis.applicationUrl,
        artifacts: campaignArtifacts(manifest.files),
        audience: decisions.audience,
        campaignRunId: runId,
        canonicalUrl,
        category: null,
        capturedAt,
        company: campaign.recommendation.job.company,
        compensations:
          registryAnalysis.compensations.length > 0
            ? registryAnalysis.compensations
            : undefined,
        confidence: campaign.recommendation.recommendation.confidence,
        details: hasOpportunityDetails(registryAnalysis.details)
          ? registryAnalysis.details
          : undefined,
        deviceId,
        fitAssessment,
        fitScore: fitAssessment.score,
        followUpAt: null,
        jobContentHash: Encoding.encodeHex(contentHash),
        jobKey,
        identityResolution:
          targetResolution?.action === 'capture'
            ? targetResolution.identityResolution
            : undefined,
        location: campaign.recommendation.job.location || null,
        lastContactAt: null,
        operationId,
        openStatus: null,
        personalPriority: null,
        profile: decisions.profile,
        role: campaign.recommendation.job.role,
        recommendedAction: null,
        remotePolicy: campaign.recommendation.job.workMode || null,
        researchPriority: null,
        source,
        sourceConfidence: null,
        sourceJobId: null,
        submissionDetails: registryAnalysis.submissionDetails,
        targetStage: 'apply_next',
        technologyStack:
          campaign.recommendation.job.technologies.join(', ') || null,
        appliedAt: null,
      } satisfies ApplicationRegistryCampaignCaptureRequest
      const result = yield* client.capture(request)

      yield* result.status === 'queued'
        ? Effect.logWarning(
            `Application registry is unavailable; queued ${result.operationId} in the local outbox.`
          )
        : Effect.logInfo(
            `Application registry captured ${result.response.application.id}.`
          )
      return []
    }),
  failurePolicy,
  id: 'application-registry.capture',
  label: 'Capture application in registry',
  scope: 'target',
})
