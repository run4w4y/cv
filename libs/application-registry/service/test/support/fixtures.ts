import type { ApplicationListRecord } from '@cv/application-registry-crud'
import type {
  Application,
  ApplicationCompensation,
  ApplicationEvent,
  ApplicationLabel,
  ApplicationNote,
  CampaignCapture,
  CommandReceipt,
  FxRate,
} from '@cv/application-registry-entity'

export const recordedAt = '2026-07-12T12:00:00.000Z'

export const application: Application = {
  applicationStatus: 'preparing',
  appliedAt: null,
  canonicalUrl: 'https://example.test/jobs/one',
  category: null,
  company: 'Example',
  createdAt: recordedAt,
  details: null,
  fitScore: null,
  followUpAt: null,
  id: 'application-1',
  jobKey: 'test:one',
  lastContactAt: null,
  location: null,
  openStatus: null,
  personalPriority: null,
  recommendedAction: null,
  remotePolicy: null,
  researchPriority: null,
  role: 'Engineer',
  source: 'test',
  sourceConfidence: null,
  sourceJobId: null,
  targetStage: 'backlog',
  technologyStack: null,
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

export const capture: CampaignCapture = {
  applicationId: application.id,
  artifacts: [],
  audience: null,
  campaignRunId: 'run-1',
  capturedAt: recordedAt,
  confidence: 0.8,
  id: 'capture-1',
  jobContentHash: null,
  operationId: 'capture-operation-1',
  profile: 'default',
  submissionDetails: {
    additionalInstructions: null,
    applicationMethod: 'web',
    applicationQuestions: [],
    applicationUrl: application.canonicalUrl,
    contactEmail: null,
    coverLetterInstructions: null,
    deadline: null,
    employmentType: null,
    languageRequirements: [],
    locationRestrictions: null,
    relocation: null,
    requiredDocuments: [],
    salary: null,
    visaRequirements: null,
    workMode: null,
  },
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
  captureCount: 0,
  compensations: [],
  labels: [],
  latestEventAt: null,
  latestEventKind: null,
  noteCount: 0,
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
  captureId: null,
  eventId: null,
  kind: 'application_note',
  noteId: note.id,
  operationId: 'note-operation-1',
  recordedAt,
  operationRequestSignature: '',
  ...input,
})
