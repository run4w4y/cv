import type { ApplicationListRecord } from '@cv/application-registry-crud'
import type {
  Application,
  ApplicationCompensation,
  ApplicationEvent,
  ApplicationLabel,
  ApplicationNote,
  CommandReceipt,
  FxRate,
} from '@cv/application-registry-entity'

export const recordedAt = '2026-07-12T12:00:00.000Z'

export const application: Application = {
  applicationStatus: 'preparing',
  appliedAt: null,
  canonicalUrl: 'https://example.test/jobs/one',
  company: 'Example',
  createdAt: recordedAt,
  followUpAt: null,
  id: 'application-1',
  jobKey: 'test:one',
  lastContactAt: null,
  listingAvailability: 'unchecked',
  listingCheckedAt: null,
  listingClosedCandidateAt: null,
  listingConfidence: null,
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  location: null,
  personalPriority: null,
  role: 'Engineer',
  source: 'test',
  sourceJobId: null,
  targetStage: 'backlog',
  updatedAt: recordedAt,
  updatedRevision: 3,
  version: 1,
}

export const label: ApplicationLabel = {
  applicationId: application.id,
  createdAt: recordedAt,
  label: 'priority',
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

export const event: ApplicationEvent = {
  applicationId: application.id,
  deviceId: 'test',
  id: 'event-1',
  kind: 'stage_changed',
  occurredAt: recordedAt,
  operationId: 'event-operation-1',
  payload: {},
  recordedAt,
  revision: 4,
}

export const registryEventListItem = {
  ...event,
  canonicalUrl: application.canonicalUrl,
  company: application.company,
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
  identityAliases: [],
  labels: [],
  latestEvent: null,
}

export const fxRate: FxRate = {
  baseCurrency: 'EUR',
  fetchedAt: recordedAt,
  observedAt: recordedAt,
  provider: 'test',
  quoteCurrency: 'USD',
  rate: 1.1,
}

export const receipt = (
  input: Partial<CommandReceipt> = {}
): CommandReceipt => ({
  applicationId: application.id,
  eventId: null,
  kind: 'application_note',
  noteId: note.id,
  operationId: 'note-operation-1',
  recordedAt,
  operationRequestSignature: '',
  ...input,
})
