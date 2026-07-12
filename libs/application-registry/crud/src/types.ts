import type {
  ApplicationCompensationInput,
  ApplicationEvent,
  ApplicationMutable,
  ApplicationNote,
  ApplicationStatus,
  ApplicationWritable,
  CampaignCapture,
  TargetStage,
  UtcIsoTimestamp,
} from '@cv/application-registry-entity'

export type CrudPage<A> = {
  readonly hasNextPage: boolean
  readonly items: readonly A[]
}

export type ApplicationListFilter = {
  readonly afterRevision?: number
  readonly applicationStatus?: ApplicationStatus
  readonly company?: string
  readonly label?: string
  readonly limit: number
  readonly targetStage?: TargetStage
  readonly url?: string
}

export type EventListFilter = {
  readonly afterRevision?: number
  readonly limit: number
}

export type ApplicationPatch = ApplicationMutable & {
  readonly expectedVersion?: number
}

export type ApplicationWriteMode = 'capture' | 'replace'

export interface PersistApplicationOptions {
  readonly mode: ApplicationWriteMode
  readonly operation: string
}

export type PersistedCompensation = ApplicationCompensationInput & {
  readonly id: string
}

export type PersistedApplication = ApplicationWritable & {
  readonly applicationId: string
  readonly compensations?: readonly PersistedCompensation[]
  readonly labels?: readonly string[]
  readonly recordedAt: UtcIsoTimestamp
}

type PersistedCaptureFields = Pick<
  CampaignCapture,
  | 'artifacts'
  | 'audience'
  | 'campaignRunId'
  | 'capturedAt'
  | 'confidence'
  | 'jobContentHash'
  | 'operationId'
  | 'profile'
  | 'submissionDetails'
>

export type PersistedCapture = PersistedApplication &
  PersistedCaptureFields & {
    readonly captureId: string
    readonly deviceId: string | null
    readonly eventId: string
    readonly requestFingerprint: string
  }

export type PersistedEvent = Pick<
  ApplicationEvent,
  'deviceId' | 'kind' | 'occurredAt' | 'operationId' | 'payload'
> & {
  readonly eventId: string
  readonly recordedAt: UtcIsoTimestamp
  readonly requestFingerprint: string
}

export type PersistedNote = Pick<
  ApplicationNote,
  'body' | 'kind' | 'source'
> & {
  readonly eventId: string
  readonly noteId: string
  readonly operationId: string
  readonly recordedAt: UtcIsoTimestamp
  readonly requestFingerprint: string
}
