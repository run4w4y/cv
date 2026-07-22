import type { ApplicationListRecord } from '@cv/application-registry-crud'
import type {
  Application,
  ApplicationActivity,
  ApplicationCompensation,
  ApplicationNote,
  IdempotencyReceipt,
} from '@cv/application-registry-entity'
import type { RegistryActivityListItem } from '@cv/application-registry-entity/query'

export const recordedAt = '2026-07-12T12:00:00.000Z'

export const application: Application = {
  applicationStatus: 'preparing',
  appliedAt: null,
  company: 'Example',
  createdAt: recordedAt,
  followUpAt: null,
  id: 'application-1',
  listingAvailability: 'unchecked',
  listingCheckedAt: null,
  listingClosedCandidateAt: null,
  listingConfidence: null,
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  location: null,
  personalPriority: null,
  postingUrl: 'https://example.test/jobs/one',
  role: 'Engineer',
  targetStage: 'backlog',
  updatedAt: recordedAt,
  updatedRevision: 3,
  version: 1,
}

export const note: ApplicationNote = {
  applicationId: application.id,
  body: 'Follow up',
  createdAt: recordedAt,
  id: 'note-1',
  kind: 'general',
  source: 'test',
  updatedAt: recordedAt,
}

export const activity: ApplicationActivity = {
  actor: 'user',
  applicationId: application.id,
  id: 'activity-1',
  kind: 'details_changed',
  occurredAt: recordedAt,
  payload: {},
  revision: 4,
  source: 'management',
}

export const registryActivityListItem: RegistryActivityListItem = {
  ...activity,
  company: application.company,
  postingUrl: application.postingUrl,
  role: application.role,
}

export const compensation: ApplicationCompensation = {
  applicationId: application.id,
  createdAt: recordedAt,
  currencyCode: 'EUR',
  id: 'compensation-1',
  kind: 'base_salary',
  maximumMinor: 12_000_000,
  minimumMinor: 10_000_000,
  period: 'year',
  rawText: null,
  source: 'test',
  updatedAt: recordedAt,
}

export const applicationListRecord: ApplicationListRecord = {
  ...application,
  compensations: [],
  counts: { notes: 0 },
  labels: [],
  latestActivity: null,
}

export const receipt = (
  input: Partial<IdempotencyReceipt> = {}
): IdempotencyReceipt => ({
  applicationId: application.id,
  createdAt: recordedAt,
  idempotencyKey: 'note-operation-1',
  requestHash: '',
  resourceId: note.id,
  scope: 'application_note',
  ...input,
})
