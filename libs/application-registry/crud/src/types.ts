import type {
  Application,
  ApplicationCompensation,
  ApplicationCompensationInput,
  ApplicationEvent,
  ApplicationEventKind,
  ApplicationMutable,
  ApplicationNote,
  ApplicationStatus,
  ApplicationWritable,
  CampaignCapture,
  PersonalPriority,
  TargetStage,
  UtcIsoTimestamp,
} from '@cv/application-registry-entity'

export type CrudPage<A> = {
  readonly hasNextPage: boolean
  readonly items: readonly A[]
}

export type ApplicationListFilter = {
  readonly afterRevision?: number
  readonly applicationStatus?: readonly ApplicationStatus[]
  readonly company?: string
  readonly followUpState?: readonly FollowUpState[]
  readonly label?: readonly string[]
  readonly limit: number
  readonly location?: string
  readonly now: UtcIsoTimestamp
  readonly personalPriority?: readonly PersonalPriority[]
  readonly role?: string
  readonly targetStage?: readonly TargetStage[]
  readonly url?: string
}

export type EventListFilter = {
  readonly afterRevision?: number
  readonly from?: UtcIsoTimestamp
  readonly kind?: readonly ApplicationEventKind[]
  readonly limit: number
  readonly to?: UtcIsoTimestamp
}

export type FollowUpState = 'none' | 'overdue' | 'upcoming'

export type ApplicationListRecord = Application & {
  readonly captureCount: number
  readonly compensations: readonly ApplicationCompensation[]
  readonly labels: readonly string[]
  readonly latestEventAt: UtcIsoTimestamp | null
  readonly latestEventKind: ApplicationEventKind | null
  readonly noteCount: number
}

export type ApplicationFacets = {
  readonly applicationStatuses: readonly ApplicationStatus[]
  readonly companies: readonly string[]
  readonly labels: readonly string[]
  readonly personalPriorities: readonly PersonalPriority[]
  readonly targetStages: readonly TargetStage[]
}

export type RegistryEventListItem = ApplicationEvent & {
  readonly canonicalUrl: string
  readonly company: string
  readonly role: string
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
    readonly operationRequestSignature: string
  }

export type PersistedEvent = Pick<
  ApplicationEvent,
  'deviceId' | 'kind' | 'occurredAt' | 'operationId' | 'payload'
> & {
  readonly eventId: string
  readonly recordedAt: UtcIsoTimestamp
  readonly operationRequestSignature: string
}

export type PersistedNote = Pick<
  ApplicationNote,
  'body' | 'kind' | 'source'
> & {
  readonly eventId: string
  readonly noteId: string
  readonly operationId: string
  readonly recordedAt: UtcIsoTimestamp
  readonly operationRequestSignature: string
}
