import { describe, expect, test } from 'bun:test'

import type {
  ApplicationRegistryEnv,
  WorkerWorkflowInstance,
  WorkerWorkflowStatus,
} from '../worker/types'
import {
  getPdfWorkflow,
  PdfWorkflowConfigurationError,
  PdfWorkflowStartError,
  startPdfWorkflow,
} from './trigger'

const publication = {
  enabled: true,
  publicationVersion: 4,
  publicUrl: 'https://cv.example.test/c/stable-token',
  publishedRevisionId: 'revision-1',
  version: 4,
}

const environmentWith = (create: ApplicationRegistryEnv['CV_PDF_WORKFLOW']) =>
  ({ CV_PDF_WORKFLOW: create }) as ApplicationRegistryEnv

const instance = (
  id: string,
  status: WorkerWorkflowStatus
): WorkerWorkflowInstance => ({
  id,
  status: async () => status,
})

describe('PDF Workflow trigger', () => {
  test('starts a deterministic job with only the persisted exact public URL', async () => {
    const created: unknown[] = []
    const environment = environmentWith({
      create: async (options) => {
        created.push(options)
        return instance(options.id ?? '', { status: 'queued' })
      },
      get: async (id) => instance(id, { status: 'unknown' }),
    })

    const first = await startPdfWorkflow(environment, {
      applicationId: 'application-1',
      entryId: 'entry-1',
      expectedPublicationVersion: 4,
      publication,
      rendererVersion: 'renderer-v1',
    })
    const second = await startPdfWorkflow(environment, {
      applicationId: 'application-1',
      entryId: 'entry-1',
      expectedPublicationVersion: 4,
      publication,
      rendererVersion: 'renderer-v1',
    })

    expect(first.workflowId).toBe(second.workflowId)
    expect(first.workflowId).toMatch(/^cvpdf_[a-f\d]{64}$/u)
    expect(created).toHaveLength(2)
    expect(created[0]).toEqual({
      id: first.workflowId,
      params: {
        applicationId: 'application-1',
        entryId: 'entry-1',
        expectedPublicationVersion: 4,
        publicUrl: publication.publicUrl,
        rendererVersion: 'renderer-v1',
      },
    })
  })

  test('returns an existing deterministic instance after duplicate creation', async () => {
    const environment = environmentWith({
      create: async () => {
        throw new Error('instance already exists')
      },
      get: async (id) =>
        instance(id, {
          output: {
            artifactId: 'artifact-1',
            publicUrl: publication.publicUrl,
            status: 'ready',
          },
          status: 'complete',
        }),
    })

    const response = await startPdfWorkflow(environment, {
      applicationId: 'application-1',
      entryId: 'entry-1',
      expectedPublicationVersion: 4,
      publication,
      rendererVersion: 'renderer-v1',
    })

    expect(response.status).toBe('complete')
    expect(response.artifactId).toBe('artifact-1')
  })

  test('uses publication version and exact public URL in Workflow identity', async () => {
    const createdIds: string[] = []
    const environment = environmentWith({
      create: async (options) => {
        createdIds.push(options.id ?? '')
        return instance(options.id ?? '', { status: 'queued' })
      },
      get: async (id) => instance(id, { status: 'unknown' }),
    })

    await startPdfWorkflow(environment, {
      applicationId: 'application-1',
      entryId: 'entry-1',
      expectedPublicationVersion: 4,
      publication,
      rendererVersion: 'renderer-v1',
    })
    await startPdfWorkflow(environment, {
      applicationId: 'application-1',
      entryId: 'entry-1',
      expectedPublicationVersion: 5,
      publication: { ...publication, publicationVersion: 5, version: 5 },
      rendererVersion: 'renderer-v1',
    })
    await startPdfWorkflow(environment, {
      applicationId: 'application-1',
      entryId: 'entry-1',
      expectedPublicationVersion: 4,
      publication: { ...publication, version: 5 },
      rendererVersion: 'renderer-v1',
    })
    await startPdfWorkflow(environment, {
      applicationId: 'application-1',
      entryId: 'entry-1',
      expectedPublicationVersion: 4,
      publication: {
        ...publication,
        publicUrl: 'https://another-cv.example.test/c/stable-token',
      },
      rendererVersion: 'renderer-v1',
    })

    expect(new Set(createdIds).size).toBe(3)
  })

  test('starts a new deterministic attempt after a failed Workflow', async () => {
    const statuses = new Map<string, WorkerWorkflowStatus>()
    let newlyCreated = 0
    const environment = environmentWith({
      create: async (options) => {
        const id = options.id ?? ''
        if (statuses.has(id)) throw new Error('instance already exists')
        const status: WorkerWorkflowStatus =
          newlyCreated === 0
            ? {
                error: { message: 'render failed', name: 'Error' },
                status: 'errored',
              }
            : { status: 'queued' }
        newlyCreated += 1
        statuses.set(id, status)
        return instance(id, status)
      },
      get: async (id) =>
        instance(id, statuses.get(id) ?? { status: 'unknown' }),
    })
    const input = {
      applicationId: 'application-1',
      entryId: 'entry-1',
      expectedPublicationVersion: 4,
      publication,
      rendererVersion: 'renderer-v1',
    } as const

    const failed = await startPdfWorkflow(environment, input)
    const retry = await startPdfWorkflow(environment, input)
    const replay = await startPdfWorkflow(environment, input)

    expect(failed.status).toBe('errored')
    expect(retry.status).toBe('queued')
    expect(retry.workflowId).not.toBe(failed.workflowId)
    expect(replay.workflowId).toBe(retry.workflowId)
    expect(newlyCreated).toBe(2)
  })

  test('reads durable status without exposing arbitrary workflow output', async () => {
    const environment = environmentWith({
      create: async () => instance('unused', { status: 'queued' }),
      get: async (id) =>
        instance(id, {
          output: { secret: 'ignored' },
          status: 'running',
        }),
    })

    expect(await getPdfWorkflow(environment, 'workflow-1')).toEqual({
      artifactId: null,
      errorMessage: null,
      status: 'running',
      workflowId: 'workflow-1',
    })
  })

  test('fails closed for missing binding, disabled links, and stale versions', async () => {
    await expect(
      startPdfWorkflow({} as ApplicationRegistryEnv, {
        applicationId: 'application-1',
        entryId: 'entry-1',
        expectedPublicationVersion: 4,
        publication,
        rendererVersion: 'renderer-v1',
      })
    ).rejects.toBeInstanceOf(PdfWorkflowConfigurationError)

    const environment = environmentWith({
      create: async () => instance('unused', { status: 'queued' }),
      get: async (id) => instance(id, { status: 'unknown' }),
    })
    await expect(
      startPdfWorkflow(environment, {
        applicationId: 'application-1',
        entryId: 'entry-1',
        expectedPublicationVersion: 4,
        publication: { ...publication, enabled: false },
        rendererVersion: 'renderer-v1',
      })
    ).rejects.toBeInstanceOf(PdfWorkflowStartError)
    await expect(
      startPdfWorkflow(environment, {
        applicationId: 'application-1',
        entryId: 'entry-1',
        expectedPublicationVersion: 3,
        publication,
        rendererVersion: 'renderer-v1',
      })
    ).rejects.toBeInstanceOf(PdfWorkflowStartError)
  })
})
