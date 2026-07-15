import type {
  Application,
  ApplicationCompensation,
  ApplicationCompensationInput,
  ApplicationEvent,
  ApplicationListingCheck,
  ApplicationListingCheckSchedule,
  ApplicationMutable,
  ApplicationNote,
  ApplicationStatus,
  ApplicationWritable,
  CampaignCapture,
  ListingAvailability,
  ListingCheckConfidence,
  ListingCheckMode,
  ListingCheckReason,
  ListingCheckRun,
  ListingCheckRunTrigger,
  PersonalPriority,
  TargetStage,
  UtcIsoTimestamp,
} from '@cv/application-registry-entity'
import type {
  applicationListQuery,
  eventListQuery,
  RegistryEventListItem,
} from '@cv/application-registry-entity/query'
import type {
  CursorPageInfo,
  QueryPage,
  QueryResolutionOf,
} from '@cv/drizzle-query'

export type ApplicationListResolution = QueryResolutionOf<
  typeof applicationListQuery
>

export type EventListResolution = QueryResolutionOf<typeof eventListQuery>

export type ApplicationListCounts = {
  readonly captures: number
  readonly notes: number
}

export type ApplicationListLatestEvent = Pick<
  ApplicationEvent,
  'kind' | 'occurredAt'
>

export type ApplicationListLatestCapture = Pick<
  CampaignCapture,
  'applicationUrl'
>

export type ApplicationListRecord = Application & {
  readonly compensations: readonly ApplicationCompensation[]
  readonly counts: ApplicationListCounts
  readonly identityAliases: readonly string[]
  readonly labels: readonly string[]
  readonly latestCapture: ApplicationListLatestCapture | null
  readonly latestEvent: ApplicationListLatestEvent | null
}

export type ApplicationListPage = QueryPage<
  ApplicationListRecord,
  CursorPageInfo
>

export type ApplicationFacets = {
  readonly applicationStatuses: readonly ApplicationStatus[]
  readonly companies: readonly string[]
  readonly labels: readonly string[]
  readonly personalPriorities: readonly PersonalPriority[]
  readonly targetStages: readonly TargetStage[]
}

export type EventListPage = QueryPage<RegistryEventListItem, CursorPageInfo>

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
  | 'applicationUrl'
  | 'fitAssessment'
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
    readonly identityAlias?: string
    readonly operationRequestSignature: string
    readonly writeMode: ApplicationWriteMode
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

export type ListingCheckRunCounts = Pick<
  ListingCheckRun,
  | 'checkedCount'
  | 'closedCount'
  | 'errorCount'
  | 'openCount'
  | 'reviewCount'
  | 'selectedCount'
>

export type PersistedListingCheck = ApplicationListingCheck & {
  readonly archiveApplication: boolean
  readonly closedCandidateAt: string | null
  readonly consecutiveClosedChecks: number
  readonly eventId: string | null
  readonly listingAvailability: ListingAvailability
  readonly recordedAt: string
}

export type StartListingCheckRun = {
  readonly id: string
  readonly mode: ListingCheckMode
  readonly selectedCount: number
  readonly startedAt: string
  readonly trigger: ListingCheckRunTrigger
}

export type ClaimedListingCheckSchedule = ApplicationListingCheckSchedule & {
  readonly leaseToken: string
  readonly leaseUntil: string
}

export type ListingCheckProjection = {
  readonly availability: ListingAvailability
  readonly checkedAt: string
  readonly closedCandidateAt: string | null
  readonly confidence: ListingCheckConfidence
  readonly consecutiveClosedChecks: number
  readonly reasonCode: ListingCheckReason
}
