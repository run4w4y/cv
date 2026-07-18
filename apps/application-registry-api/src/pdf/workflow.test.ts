import { describe, expect, test } from 'bun:test'
import type { BrowserWorker } from '@cloudflare/puppeteer'

import type { ApplicationRegistryEnv } from '../worker/types'
import {
  assertCvFitsSingleA4Page,
  CvPageLayoutError,
  type PdfWorkflowArtifact,
  type PdfWorkflowDependencies,
  type PdfWorkflowEnvironment,
  type PdfWorkflowParams,
  type PdfWorkflowStep,
  runPdfWorkflow,
} from './workflow'

const fittingPage = {
  documentCount: 1,
  pageHeightPx: 1_122.52,
  pageWidthPx: 793.7,
  renderedHeightPx: 1_122.52,
  renderedWidthPx: 793.7,
  scrollHeightPx: 1_123,
  scrollWidthPx: 794,
} as const

const params: PdfWorkflowParams = {
  applicationId: 'application-1',
  entryId: 'entry-1',
  expectedPublicationVersion: 3,
  publicUrl: 'https://cv.example.test/c/stable-token',
  rendererVersion: 'renderer-v1',
}

const environment = {
  BROWSER: {} as BrowserWorker,
} as PdfWorkflowEnvironment & ApplicationRegistryEnv

const pending: PdfWorkflowArtifact = {
  id: 'artifact-1',
  publicationVersion: params.expectedPublicationVersion,
  qrTarget: params.publicUrl,
  status: 'pending',
}

const makeStep = () => {
  const names: string[] = []
  const step = {
    do: async (
      name: string,
      _config: unknown,
      operation: () => Promise<unknown>
    ) => {
      names.push(name)
      return operation()
    },
  } as unknown as PdfWorkflowStep
  return { names, step }
}

test('renders and stores a PDF for the exact persisted public URL', async () => {
  const calls: string[] = []
  const dependencies: PdfWorkflowDependencies = {
    begin: async (_environment, input, workflowId) => {
      calls.push(`begin:${workflowId}:${input.publicUrl}`)
      return pending
    },
    complete: async (_environment, _applicationId, artifactId, bytes) => {
      calls.push(`complete:${artifactId}:${new TextDecoder().decode(bytes)}`)
      return { ...pending, status: 'ready' }
    },
    disable: async () => {
      calls.push('disable')
    },
    fail: async () => {
      calls.push('fail')
      return { ...pending, status: 'failed' }
    },
    render: async (_browser, publicUrl) => {
      calls.push(`render:${publicUrl}`)
      return new TextEncoder().encode('%PDF exact URL')
    },
  }
  const { names, step } = makeStep()

  const result = await runPdfWorkflow(
    environment,
    { instanceId: 'workflow-1', payload: params },
    step,
    dependencies
  )

  expect(result).toEqual({
    artifactId: pending.id,
    publicUrl: params.publicUrl,
    status: 'ready',
  })
  expect(calls).toEqual([
    `begin:workflow-1:${params.publicUrl}`,
    `render:${params.publicUrl}`,
    `complete:${pending.id}:%PDF exact URL`,
  ])
  expect(names).toEqual([
    'pin approved CV revision',
    'render exact public CV URL',
    'persist PDF artifact',
  ])
})

describe('A4 publication guard', () => {
  test('accepts a single document at the browser-measured A4 boundary', () => {
    expect(() => assertCvFitsSingleA4Page(fittingPage)).not.toThrow()
  })

  test('reports layout overflow without inspecting document fields', () => {
    expect(() =>
      assertCvFitsSingleA4Page({
        ...fittingPage,
        scrollHeightPx: fittingPage.pageHeightPx + 24,
      })
    ).toThrow('The CV exceeds one A4 page by 24.0 CSS px vertically.')
  })

  test('requires exactly one measurable renderer boundary', () => {
    expect(() =>
      assertCvFitsSingleA4Page({ ...fittingPage, documentCount: 0 })
    ).toThrow('Expected exactly one printable CV document, found 0.')
  })
})

describe('failure compensation', () => {
  test('records render failure and disables the incomplete publication', async () => {
    const calls: string[] = []
    const dependencies: PdfWorkflowDependencies = {
      begin: async () => pending,
      complete: async () => {
        throw new Error('complete must not run')
      },
      disable: async (
        _environment,
        applicationId,
        entryId,
        expectedPublicationVersion,
        reason
      ) => {
        calls.push(
          `disable:${applicationId}:${entryId}:${expectedPublicationVersion}:${reason}`
        )
      },
      fail: async (_environment, applicationId, artifactId, code, message) => {
        calls.push(`fail:${applicationId}:${artifactId}:${code}:${message}`)
        return { ...pending, status: 'failed' }
      },
      render: async () => {
        throw new Error('browser unavailable')
      },
    }
    const { names, step } = makeStep()

    await expect(
      runPdfWorkflow(
        environment,
        { instanceId: 'workflow-2', payload: params },
        step,
        dependencies
      )
    ).rejects.toThrow('browser unavailable')

    expect(calls).toEqual([
      `fail:${params.applicationId}:${pending.id}:pdf_render_failed:browser unavailable`,
      `disable:${params.applicationId}:${params.entryId}:${params.expectedPublicationVersion}:PDF generation did not complete.`,
    ])
    expect(names).toContain('record PDF failure')
    expect(names).toContain('disable incomplete publication')
  })

  test('rejects a job whose public URL differs from the persisted QR target', async () => {
    const calls: string[] = []
    const dependencies: PdfWorkflowDependencies = {
      begin: async () => ({ ...pending, qrTarget: 'https://wrong.test/cv' }),
      complete: async () => ({ ...pending, status: 'ready' }),
      disable: async () => {
        calls.push('disable')
      },
      fail: async () => {
        calls.push('fail')
        return { ...pending, status: 'failed' }
      },
      render: async () => {
        calls.push('render')
        return new Uint8Array()
      },
    }

    await expect(
      runPdfWorkflow(
        environment,
        { instanceId: 'workflow-3', payload: params },
        makeStep().step,
        dependencies
      )
    ).rejects.toThrow('does not match its persisted artifact')
    expect(calls).toEqual(['fail', 'disable'])
  })

  test('records page overflow distinctly and disables the publication', async () => {
    const calls: string[] = []
    const dependencies: PdfWorkflowDependencies = {
      begin: async () => pending,
      complete: async () => {
        throw new Error('complete must not run')
      },
      disable: async (
        _environment,
        applicationId,
        entryId,
        expectedPublicationVersion,
        reason
      ) => {
        calls.push(
          `disable:${applicationId}:${entryId}:${expectedPublicationVersion}:${reason}`
        )
      },
      fail: async (_environment, applicationId, artifactId, code, message) => {
        calls.push(`fail:${applicationId}:${artifactId}:${code}:${message}`)
        return { ...pending, status: 'failed' }
      },
      render: async () => {
        throw new CvPageLayoutError(
          'cv_page_overflow',
          'The CV exceeds one A4 page by 12.0 CSS px vertically.'
        )
      },
    }

    await expect(
      runPdfWorkflow(
        environment,
        { instanceId: 'workflow-overflow', payload: params },
        makeStep().step,
        dependencies
      )
    ).rejects.toThrow('exceeds one A4 page')

    expect(calls).toEqual([
      `fail:${params.applicationId}:${pending.id}:cv_page_overflow:The CV exceeds one A4 page by 12.0 CSS px vertically.`,
      `disable:${params.applicationId}:${params.entryId}:${params.expectedPublicationVersion}:CV content exceeds one A4 page.`,
    ])
  })
})
