import { describe, expect, test } from 'bun:test'

import {
  batchCompletionPercent,
  dashboardMetrics,
  formatWorkflowDuration,
  type WorkflowBatchListItem,
  workflowJobTitle,
  workflowStageLabel,
  workflowStatusLabel,
} from './presentation'

const batch = (
  overrides: Partial<WorkflowBatchListItem> = {}
): WorkflowBatchListItem => ({
  active: 2,
  batchId: 'batch-1',
  cancelled: 0,
  completed: 1,
  createdAt: 1_000,
  failed: 1,
  kinds: ['cv'],
  locale: 'en',
  needsReview: 1,
  status: 'running',
  total: 5,
  updatedAt: 2_000,
  targetCount: 5,
  ...overrides,
})

describe('workflow presentation', () => {
  test('counts only terminal jobs as batch completion', () => {
    expect(batchCompletionPercent(batch())).toBe(40)
    expect(batchCompletionPercent(batch({ total: 0 }))).toBe(0)
  })

  test('aggregates operational metrics across batches', () => {
    expect(
      dashboardMetrics([
        batch(),
        batch({ active: 1, completed: 4, failed: 0, needsReview: 0 }),
      ])
    ).toEqual({ active: 3, completed: 5, failed: 1, needsReview: 1 })
  })

  test('uses workflow language instead of raw enum labels', () => {
    expect(workflowStatusLabel('needs_review')).toBe('Needs review')
    expect(workflowStatusLabel('review_submitted')).toBe('Finishing approval')
    expect(workflowStageLabel('planning')).toBe('Plan composition')
    expect(workflowStageLabel('composition')).toBe('Compose candidate')
  })

  test('replaces the URL hostname with the analyzed role and company', () => {
    expect(
      workflowJobTitle({
        company: null,
        role: null,
        url: 'https://careers.example.test/jobs/platform',
      })
    ).toBe('careers.example.test')
    expect(
      workflowJobTitle({
        company: 'Example',
        role: 'Platform Engineer',
        url: 'https://careers.example.test/jobs/platform',
      })
    ).toBe('Platform Engineer · Example')
  })

  test('formats short and long run durations', () => {
    expect(formatWorkflowDuration(0, 45_000)).toBe('45s')
    expect(formatWorkflowDuration(0, 125_000)).toBe('2m 5s')
    expect(formatWorkflowDuration(0, 3_720_000)).toBe('1h 2m')
  })
})
