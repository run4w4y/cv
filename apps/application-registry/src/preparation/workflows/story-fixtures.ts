import type {
  BatchPreparationForm,
  BatchPreparationUrlRow,
} from '@/preparation/batch/atoms'

import type {
  WorkflowBatchListItem,
  WorkflowJobListItem,
  WorkflowStepListItem,
} from './presentation'

export const workflowStoryNow = Date.parse('2026-07-21T11:30:00.000Z')

export const parallelBatchId = 'batch-20260721-parallel-cv'

export const parallelWorkflowJobs = [
  {
    applicationId: 'application-northstar-staff-platform',
    batchId: parallelBatchId,
    createdAt: Date.parse('2026-07-21T11:00:00.000Z'),
    error: null,
    kind: 'cv',
    locale: 'en',
    message: 'Composing the tailored CV candidate.',
    position: 0,
    runId: 'run-northstar-composing',
    stage: 'composition',
    status: 'running',
    updatedAt: Date.parse('2026-07-21T11:24:00.000Z'),
    url: 'https://careers.northstar.example/jobs/staff-platform-engineer',
  },
  {
    applicationId: 'application-polaris-principal-frontend',
    batchId: parallelBatchId,
    createdAt: Date.parse('2026-07-21T11:00:01.000Z'),
    error: null,
    kind: 'cv',
    locale: 'en',
    message: 'Candidate saved and ready for a human decision.',
    position: 1,
    runId: 'run-polaris-needs-review',
    stage: 'review',
    status: 'awaiting_review',
    updatedAt: Date.parse('2026-07-21T11:19:30.000Z'),
    url: 'https://jobs.polaris.example/principal-frontend-engineer',
  },
  {
    applicationId: 'application-cedar-product-engineer',
    batchId: parallelBatchId,
    createdAt: Date.parse('2026-07-21T11:00:02.000Z'),
    error:
      'Generated candidate did not satisfy the CV schema after the repair attempt.',
    kind: 'cv',
    locale: 'en',
    message: 'Candidate validation failed.',
    position: 2,
    runId: 'run-cedar-validation-failed',
    stage: 'validation',
    status: 'failed',
    updatedAt: Date.parse('2026-07-21T11:16:45.000Z'),
    url: 'https://work.cedar.example/openings/product-engineer',
  },
  {
    applicationId: 'application-orbit-engineering-lead',
    batchId: parallelBatchId,
    createdAt: Date.parse('2026-07-21T11:00:03.000Z'),
    error: null,
    kind: 'cv',
    locale: 'en',
    message: 'Candidate approved.',
    position: 3,
    runId: 'run-orbit-approved',
    stage: 'complete',
    status: 'approved',
    updatedAt: Date.parse('2026-07-21T11:21:10.000Z'),
    url: 'https://orbit.example/careers/engineering-lead',
  },
  {
    applicationId: null,
    batchId: parallelBatchId,
    createdAt: Date.parse('2026-07-21T11:00:04.000Z'),
    error: null,
    kind: 'cv',
    locale: 'en',
    message: 'Waiting for an available workflow slot.',
    position: 4,
    runId: 'run-river-queued',
    stage: 'queued',
    status: 'queued',
    updatedAt: Date.parse('2026-07-21T11:00:04.000Z'),
    url: 'https://river.example/jobs/senior-software-engineer',
  },
  {
    applicationId: 'application-aperture-ui-platform',
    batchId: parallelBatchId,
    createdAt: Date.parse('2026-07-21T11:00:05.000Z'),
    error: null,
    kind: 'cv',
    locale: 'en',
    message: 'Cancelled before job analysis began.',
    position: 5,
    runId: 'run-aperture-cancelled',
    stage: 'capture',
    status: 'cancelled',
    updatedAt: Date.parse('2026-07-21T11:05:20.000Z'),
    url: 'https://aperture.example/jobs/ui-platform-engineer',
  },
] satisfies ReadonlyArray<WorkflowJobListItem>

export const parallelWorkflowBatch = {
  active: 2,
  batchId: parallelBatchId,
  cancelled: 1,
  completed: 1,
  createdAt: Date.parse('2026-07-21T11:00:00.000Z'),
  failed: 1,
  kind: 'cv',
  locale: 'en',
  needsReview: 1,
  status: 'mixed',
  total: parallelWorkflowJobs.length,
  updatedAt: workflowStoryNow,
} satisfies WorkflowBatchListItem

export const workflowDashboardBatches = [
  parallelWorkflowBatch,
  {
    active: 3,
    batchId: 'batch-20260721-cover-letters',
    cancelled: 0,
    completed: 0,
    createdAt: Date.parse('2026-07-21T10:12:00.000Z'),
    failed: 0,
    kind: 'cover_letter',
    locale: 'de',
    needsReview: 2,
    status: 'active',
    total: 5,
    updatedAt: Date.parse('2026-07-21T11:28:00.000Z'),
  },
  {
    active: 0,
    batchId: 'batch-20260720-completed-cv',
    cancelled: 0,
    completed: 4,
    createdAt: Date.parse('2026-07-20T14:05:00.000Z'),
    failed: 0,
    kind: 'cv',
    locale: 'en',
    needsReview: 0,
    status: 'completed',
    total: 4,
    updatedAt: Date.parse('2026-07-20T14:42:00.000Z'),
  },
] satisfies ReadonlyArray<WorkflowBatchListItem>

const step = (
  stage: WorkflowStepListItem['stage'],
  title: string,
  description: string,
  status: WorkflowStepListItem['status'],
  startedAt: number | null,
  completedAt: number | null
): WorkflowStepListItem => ({
  completedAt,
  description,
  stage,
  startedAt,
  status,
  title,
})

const started = Date.parse('2026-07-21T11:00:00.000Z')

export const runningWorkflowSteps = [
  step(
    'queued',
    'Queue job',
    'Reserved a workflow slot for this URL.',
    'completed',
    started,
    started + 2_000
  ),
  step(
    'application',
    'Create application',
    'Created the registry application record.',
    'completed',
    started + 2_000,
    started + 8_000
  ),
  step(
    'capture',
    'Capture job posting',
    'Captured and normalized the public job description.',
    'completed',
    started + 8_000,
    started + 64_000
  ),
  step(
    'analysis',
    'Analyze role',
    'Extracted role requirements and signals.',
    'completed',
    started + 64_000,
    started + 180_000
  ),
  step(
    'evidence',
    'Select evidence',
    'Matched verified facts to the role.',
    'completed',
    started + 180_000,
    started + 420_000
  ),
  step(
    'briefs',
    'Plan document',
    'Built the section-by-section composition brief.',
    'completed',
    started + 420_000,
    started + 660_000
  ),
  step(
    'composition',
    'Compose candidate',
    'Generating the tailored candidate with two bounded Codex calls.',
    'running',
    started + 660_000,
    null
  ),
  step(
    'validation',
    'Validate candidate',
    'Check the generated document against the published schema.',
    'pending',
    null,
    null
  ),
  step(
    'saving',
    'Save candidate',
    'Persist a reviewable document revision.',
    'pending',
    null,
    null
  ),
  step(
    'review',
    'Human review',
    'Wait for an approval or rejection decision.',
    'pending',
    null,
    null
  ),
  step(
    'complete',
    'Complete workflow',
    'Record the final decision and artifact.',
    'pending',
    null,
    null
  ),
] satisfies ReadonlyArray<WorkflowStepListItem>

export const reviewWorkflowSteps = runningWorkflowSteps.map((item) => {
  if (item.stage === 'composition') {
    return {
      ...item,
      completedAt: started + 830_000,
      status: 'completed' as const,
    }
  }
  if (item.stage === 'validation') {
    return {
      ...item,
      completedAt: started + 920_000,
      startedAt: started + 830_000,
      status: 'completed' as const,
    }
  }
  if (item.stage === 'saving') {
    return {
      ...item,
      completedAt: started + 990_000,
      startedAt: started + 920_000,
      status: 'completed' as const,
    }
  }
  if (item.stage === 'review') {
    return {
      ...item,
      description: 'Candidate is stored and waiting for your decision.',
      startedAt: started + 990_000,
      status: 'waiting' as const,
    }
  }
  return item
}) satisfies ReadonlyArray<WorkflowStepListItem>

export const failedWorkflowSteps = runningWorkflowSteps.map((item) => {
  if (item.stage === 'composition') {
    return {
      ...item,
      completedAt: started + 760_000,
      status: 'completed' as const,
    }
  }
  if (item.stage === 'validation') {
    return {
      ...item,
      description:
        'Candidate remained schema-invalid after the repair attempt.',
      startedAt: started + 760_000,
      completedAt: started + 1_005_000,
      status: 'failed' as const,
    }
  }
  return item
}) satisfies ReadonlyArray<WorkflowStepListItem>

export const validWorkflowForm = {
  kind: 'cv',
  locale: 'en',
  prompt: 'Write a concise, specific, professional cover letter.',
  urls: [
    'https://careers.northstar.example/jobs/staff-platform-engineer',
    'https://jobs.polaris.example/principal-frontend-engineer',
    'https://work.cedar.example/openings/product-engineer',
  ].join('\n'),
} satisfies BatchPreparationForm

export const invalidWorkflowForm = {
  ...validWorkflowForm,
  urls: [
    'https://careers.northstar.example/jobs/staff-platform-engineer',
    'not a job URL',
    'ftp://legacy.example/openings/platform-engineer',
    'https://careers.northstar.example/jobs/staff-platform-engineer#apply',
  ].join('\n'),
} satisfies BatchPreparationForm

export const storyWorkflowUrlRows = (
  input: string
): ReadonlyArray<BatchPreparationUrlRow> => {
  const firstLineByUrl = new Map<string, number>()
  const rows: Array<BatchPreparationUrlRow> = []

  for (const [index, rawValue] of input.split(/\r?\n/u).entries()) {
    const value = rawValue.trim()
    if (value.length === 0) continue

    let parsed: URL
    try {
      parsed = new URL(value)
    } catch {
      rows.push({
        canonicalUrl: null,
        duplicateOf: null,
        line: index + 1,
        message: 'Expected an absolute URL.',
        value,
      })
      continue
    }

    if (
      (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
      parsed.username.length > 0 ||
      parsed.password.length > 0
    ) {
      rows.push({
        canonicalUrl: null,
        duplicateOf: null,
        line: index + 1,
        message: 'Enter a valid absolute HTTP(S) URL without credentials.',
        value,
      })
      continue
    }

    parsed.hash = ''
    const canonicalUrl = parsed.toString()
    const duplicateOf = firstLineByUrl.get(canonicalUrl) ?? null
    if (duplicateOf === null) firstLineByUrl.set(canonicalUrl, index + 1)

    rows.push({
      canonicalUrl,
      duplicateOf,
      line: index + 1,
      message:
        duplicateOf === null
          ? null
          : `Duplicate of line ${duplicateOf}; it will only run once.`,
      value,
    })
  }

  return rows
}
