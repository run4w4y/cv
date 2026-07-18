import type { PdfWorkflowResponse } from '@cv/application-registry-api-contract'
import type {
  ApplicationRegistryEnv,
  WorkerWorkflow,
  WorkerWorkflowStatus,
} from '../worker/types'
import type { PdfWorkflowParams, PdfWorkflowResult } from './workflow'

export class PdfWorkflowConfigurationError extends Error {
  readonly _tag = 'PdfWorkflowConfigurationError'
}

export class PdfWorkflowStartError extends Error {
  readonly _tag = 'PdfWorkflowStartError'
}

export type PdfWorkflowPublication = {
  readonly enabled: boolean
  readonly publicationVersion: number
  readonly publicUrl: string
  readonly publishedRevisionId: string
  readonly version: number
}

export type StartPdfWorkflowInput = {
  readonly applicationId: string
  readonly entryId: string
  readonly expectedPublicationVersion: number
  readonly publication: PdfWorkflowPublication
  readonly rendererVersion: string
}

const bindingOf = (
  environment: ApplicationRegistryEnv
): WorkerWorkflow<PdfWorkflowParams> => {
  if (!environment.CV_PDF_WORKFLOW) {
    throw new PdfWorkflowConfigurationError(
      'The CV PDF Workflow binding is not configured.'
    )
  }
  return environment.CV_PDF_WORKFLOW as WorkerWorkflow<PdfWorkflowParams>
}

const workflowIdFor = async (
  input: StartPdfWorkflowInput,
  attemptNumber: number
) => {
  const material = new TextEncoder().encode(
    [
      input.applicationId,
      input.entryId,
      input.publication.publishedRevisionId,
      input.rendererVersion,
      input.expectedPublicationVersion.toString(10),
      input.publication.publicUrl,
      attemptNumber.toString(10),
    ].join('\u0000')
  )
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', material))
  return `cvpdf_${[...digest]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`
}

const retryableTerminalStatus = (status: WorkerWorkflowStatus) =>
  status.status === 'errored' ||
  status.status === 'terminated' ||
  (status.status === 'complete' && workflowResult(status.output) === undefined)

const maximumWorkflowAttempts = 100

const workflowResult = (value: unknown): PdfWorkflowResult | undefined => {
  if (typeof value !== 'object' || value === null) return undefined
  const candidate = value as Partial<PdfWorkflowResult>
  return candidate.status === 'ready' &&
    typeof candidate.artifactId === 'string' &&
    typeof candidate.publicUrl === 'string'
    ? {
        artifactId: candidate.artifactId,
        publicUrl: candidate.publicUrl,
        status: 'ready',
      }
    : undefined
}

const responseOf = (
  workflowId: string,
  status: WorkerWorkflowStatus
): PdfWorkflowResponse => ({
  artifactId: workflowResult(status.output)?.artifactId ?? null,
  errorMessage: status.error?.message?.trim() || null,
  status: status.status,
  workflowId,
})

export const startPdfWorkflow = async (
  environment: ApplicationRegistryEnv,
  input: StartPdfWorkflowInput
): Promise<PdfWorkflowResponse> => {
  if (!input.publication.enabled) {
    throw new PdfWorkflowStartError(
      'The public CV link must be enabled while its PDF is generated.'
    )
  }
  if (
    input.publication.publicationVersion !== input.expectedPublicationVersion
  ) {
    throw new PdfWorkflowStartError(
      `Public CV publication version ${input.publication.publicationVersion} does not match expected version ${input.expectedPublicationVersion}.`
    )
  }

  const binding = bindingOf(environment)
  const params: PdfWorkflowParams = {
    applicationId: input.applicationId,
    entryId: input.entryId,
    expectedPublicationVersion: input.expectedPublicationVersion,
    publicUrl: input.publication.publicUrl,
    rendererVersion: input.rendererVersion,
  }
  for (
    let attemptNumber = 1;
    attemptNumber <= maximumWorkflowAttempts;
    attemptNumber += 1
  ) {
    const workflowId = await workflowIdFor(input, attemptNumber)
    try {
      const instance = await binding.create({ id: workflowId, params })
      return responseOf(workflowId, await instance.status())
    } catch (createError) {
      try {
        const existing = await binding.get(workflowId)
        const status = await existing.status()
        if (retryableTerminalStatus(status)) continue
        if (status.status !== 'unknown') return responseOf(workflowId, status)
      } catch {
        // Preserve the original create error below.
      }
      throw new PdfWorkflowStartError(
        createError instanceof Error
          ? createError.message
          : 'Failed to start PDF Workflow.'
      )
    }
  }

  throw new PdfWorkflowStartError(
    `PDF Workflow retry limit reached after ${maximumWorkflowAttempts} attempts.`
  )
}

export const getPdfWorkflow = async (
  environment: ApplicationRegistryEnv,
  workflowId: string
): Promise<PdfWorkflowResponse> => {
  const binding = bindingOf(environment)
  const instance = await binding.get(workflowId)
  return responseOf(workflowId, await instance.status())
}
