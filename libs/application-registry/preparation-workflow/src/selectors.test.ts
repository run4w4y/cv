import { describe, expect, test } from 'bun:test'

import type { PreparationRun } from './domain'
import {
  applicationRunById,
  groupPreparationRunsByBatch,
  latestApplicationRun,
  latestOpenApplicationRun,
  preparationStepTimeline,
  selectPreparationBatches,
} from './selectors'

const run = (
  runId: string,
  locale: string,
  kind: PreparationRun['kind'] = 'cv',
  status: 'queued' | 'running' | 'failed' = 'queued'
): PreparationRun => {
  const common = {
    applicationId: 'application-1',
    batchId: `batch-${runId}`,
    batchPosition: 0,
    candidate: null,
    createdAt: 1,
    kind,
    locale,
    message: 'test',
    runId,
    stepHistory: [],
    updatedAt: 1,
    url: 'https://jobs.example.test/role',
  } as const

  switch (status) {
    case 'queued':
      return { ...common, error: null, stage: 'queued', status }
    case 'running':
      return { ...common, error: null, stage: 'analysis', status }
    case 'failed':
      return { ...common, error: 'failed', stage: 'analysis', status }
  }
}

describe('preparation run selection', () => {
  test('isolates application runs by document kind and locale', () => {
    const runs = new Map([
      ['run-en', run('run-en', 'en')],
      ['run-ru', run('run-ru', 'ru')],
      ['run-letter', run('run-letter', 'en', 'cover_letter')],
    ])

    expect(latestApplicationRun(runs, 'application-1', 'cv', 'en')?.runId).toBe(
      'run-en'
    )
    expect(
      applicationRunById(runs, 'run-ru', 'application-1', 'cv', 'en')
    ).toBeNull()
    expect(
      applicationRunById(runs, 'run-letter', 'application-1', 'cv', 'en')
    ).toBeNull()
  })

  test('prefers the open review even when a stale run was requested', () => {
    const runs = new Map([
      ['run-old', run('run-old', 'en', 'cv', 'failed')],
      ['run-review', run('run-review', 'en', 'cv', 'running')],
    ])

    expect(
      latestOpenApplicationRun(runs, 'application-1', 'cv', 'en')?.runId
    ).toBe('run-review')
    expect(
      applicationRunById(runs, 'missing', 'application-1', 'cv', 'en')
    ).toBeNull()
  })

  test('groups batches in stable job order and summarizes mixed parallel work', () => {
    const runs = new Map([
      [
        'run-failed',
        {
          ...run('run-failed', 'en', 'cv', 'failed'),
          batchId: 'batch-mixed',
          batchPosition: 2,
          createdAt: 10,
          updatedAt: 40,
        },
      ],
      [
        'run-active-first',
        {
          ...run('run-active-first', 'en', 'cv', 'running'),
          batchId: 'batch-mixed',
          batchPosition: 0,
          createdAt: 10,
          updatedAt: 30,
        },
      ],
      [
        'run-active',
        {
          ...run('run-active', 'en', 'cv', 'running'),
          batchId: 'batch-mixed',
          batchPosition: 1,
          createdAt: 10,
          updatedAt: 20,
        },
      ],
      ['run-other', run('run-other', 'ru')],
    ])

    const grouped = groupPreparationRunsByBatch(runs)
    expect(grouped.get('batch-mixed')?.map(({ runId }) => runId)).toEqual([
      'run-active-first',
      'run-active',
      'run-failed',
    ])

    const batch = selectPreparationBatches(runs).find(
      ({ batchId }) => batchId === 'batch-mixed'
    )
    expect(batch).toMatchObject({
      activeCount: 2,
      createdAt: 10,
      needsReviewCount: 0,
      status: 'running',
      terminalCount: 1,
      updatedAt: 40,
    })
    expect(batch?.statusCounts).toMatchObject({
      failed: 1,
      running: 2,
    })
  })

  test('derives a complete CI-style timeline from append-only step history', () => {
    const value = {
      ...run('run-timeline', 'en', 'cv', 'failed'),
      stepHistory: [
        {
          message: 'Queued',
          occurredAt: 10,
          stage: 'queued' as const,
          status: 'running' as const,
        },
        {
          message: 'Queued',
          occurredAt: 20,
          stage: 'queued' as const,
          status: 'completed' as const,
        },
        {
          message: 'Analyzing',
          occurredAt: 20,
          stage: 'analysis' as const,
          status: 'running' as const,
        },
        {
          message: 'Analysis failed',
          occurredAt: 35,
          stage: 'analysis' as const,
          status: 'failed' as const,
        },
      ],
    }

    const timeline = preparationStepTimeline(value)
    expect(timeline.find(({ stage }) => stage === 'queued')).toEqual({
      completedAt: 20,
      message: 'Queued',
      stage: 'queued',
      startedAt: 10,
      status: 'completed',
    })
    expect(timeline.find(({ stage }) => stage === 'capture')?.status).toBe(
      'pending'
    )
    expect(timeline.find(({ stage }) => stage === 'analysis')).toEqual({
      completedAt: 35,
      message: 'Analysis failed',
      stage: 'analysis',
      startedAt: 20,
      status: 'failed',
    })
  })
})
