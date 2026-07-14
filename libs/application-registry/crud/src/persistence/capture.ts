import {
  applicationEvents,
  campaignCaptures,
  commandReceipts,
} from '@cv/application-registry-entity'
import type { BatchItem } from 'drizzle-orm/batch'

import type { RegistryConnections } from '../internal/connection'
import type { PersistedCapture } from '../types'
import { opportunityStatements } from './applications'
import { allocateRevision, currentRevision, runBatch } from './shared'

export const persistCapture = (
  database: RegistryConnections,
  input: PersistedCapture
) => {
  const statements = [
    allocateRevision(database.batch),
    ...opportunityStatements(database.batch, input, input.writeMode),
    database.batch.insert(applicationEvents).values({
      id: input.eventId,
      applicationId: input.applicationId,
      kind: 'campaign_prepared',
      revision: currentRevision,
      occurredAt: input.capturedAt,
      recordedAt: input.recordedAt,
      deviceId: input.deviceId,
      payload: {
        campaignRunId: input.campaignRunId,
        profile: input.profile,
      },
      operationId: input.operationId,
    }),
    database.batch.insert(campaignCaptures).values({
      id: input.captureId,
      applicationId: input.applicationId,
      campaignRunId: input.campaignRunId,
      profile: input.profile,
      audience: input.audience,
      confidence: input.confidence,
      fitAssessment: input.fitAssessment,
      submissionDetails: input.submissionDetails,
      artifacts: input.artifacts,
      jobContentHash: input.jobContentHash,
      capturedAt: input.capturedAt,
      operationId: input.operationId,
    }),
    database.batch.insert(commandReceipts).values({
      operationId: input.operationId,
      operationRequestSignature: input.operationRequestSignature,
      kind: 'campaign_capture',
      applicationId: input.applicationId,
      eventId: input.eventId,
      captureId: input.captureId,
      noteId: null,
      recordedAt: input.recordedAt,
    }),
  ] satisfies [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]]

  return runBatch(database.batch, 'campaign capture', statements)
}
