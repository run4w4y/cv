import { describe, expect, test } from 'bun:test'
import { Effect, Exit } from 'effect'
import {
  type CampaignProgressEvent,
  CampaignReporter,
  type CampaignReporterService,
  reportStepSkipped,
  trackCampaignStep,
} from './progress'
import type { ReadyRoutineStep } from './routine'

const step = {
  config: undefined,
  dependsOn: [],
  id: 'test-step',
  issues: [],
  label: 'Test step',
  status: 'ready',
} satisfies ReadyRoutineStep

const recordingReporter = (events: CampaignProgressEvent[]) =>
  ({
    report: (event) =>
      Effect.sync(() => {
        events.push(event)
      }),
  }) satisfies CampaignReporterService

describe('campaign progress reporting', () => {
  test('reports successful step boundaries without changing the result', async () => {
    const events: CampaignProgressEvent[] = []
    const result = await Effect.runPromise(
      trackCampaignStep(step, Effect.succeed(42)).pipe(
        Effect.provideService(CampaignReporter, recordingReporter(events))
      )
    )

    expect(result).toBe(42)
    expect(events.map((event) => event._tag)).toEqual([
      'StepStarted',
      'StepSucceeded',
    ])
  })

  test('reports failure and preserves the original error channel', async () => {
    const events: CampaignProgressEvent[] = []
    const result = await Effect.runPromiseExit(
      trackCampaignStep(step, Effect.fail(new Error('step failed'))).pipe(
        Effect.provideService(CampaignReporter, recordingReporter(events))
      )
    )

    expect(Exit.isFailure(result)).toBe(true)
    expect(events.map((event) => event._tag)).toEqual([
      'StepStarted',
      'StepFailed',
    ])
    expect(events.find((event) => event._tag === 'StepFailed')?.message).toBe(
      'step failed'
    )
  })

  test('uses a silent default reporter for programmatic callers', async () => {
    await expect(
      Effect.runPromise(reportStepSkipped(step, 'Not required'))
    ).resolves.toBeUndefined()
  })
})
