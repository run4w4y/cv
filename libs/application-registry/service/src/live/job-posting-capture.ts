import { Effect, Layer } from 'effect'

import { prepareJobPostingCapture } from '../internal/job-posting-capture'
import { ApplicationsService } from '../services/applications'
import {
  JobPostingCaptureService,
  type JobPostingCaptureService as JobPostingCaptureServiceShape,
} from '../services/job-posting-capture'
import { JobPostingSnapshotsService } from '../services/job-posting-snapshots'

const make = Effect.gen(function* () {
  const applications = yield* ApplicationsService
  const snapshots = yield* JobPostingSnapshotsService

  return {
    capture: Effect.fn('JobPostingCaptureService.capture')(
      (applicationIdentifier: string) =>
        Effect.gen(function* () {
          const application = yield* applications.find(applicationIdentifier)
          const capture = yield* prepareJobPostingCapture(
            application.postingUrl
          )
          return yield* snapshots.persist(application.id, capture)
        })
    ),
  } satisfies JobPostingCaptureServiceShape
})

export const JobPostingCaptureServiceLive = Layer.effect(
  JobPostingCaptureService,
  make
)
