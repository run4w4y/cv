import type {
  AppendableApplicationEventKind,
  Application,
  ApplicationCompensation,
  ApplicationCompensationInput,
  ApplicationEvent,
  ApplicationIdentityResolution,
  ApplicationLabel,
  ApplicationListingCheck,
  ApplicationMutable,
  ApplicationNote,
  ApplicationStatus,
  ApplicationWritable,
  CampaignCapture,
  CurrencyCode,
  InformationalApplicationEventKind,
  JsonValue,
  ListingCheckAction,
  ListingCheckMode,
  ListingCheckRun,
  ListingCheckTarget,
  ListingObservation,
  PersonalPriority,
  StatusChangingApplicationEventKind,
  TargetStage,
} from '@cv/application-registry-entity'
import type {
  ApplicationListItem,
  ApplicationListQueryRequest,
  EventListQueryRequest,
  RegistryEventListItem,
} from '@cv/application-registry-entity/query'
import type { CursorPageInfo, QueryPage } from '@cv/drizzle-query'

export type RegistryItems<A> = { readonly items: readonly A[] }

export type ApplicationAnnotations = {
  readonly labels: readonly ApplicationLabel[]
  readonly notes: readonly ApplicationNote[]
}

export type AddApplicationNoteResult = {
  readonly note: ApplicationNote
  readonly replayed: boolean
}

export type AppendApplicationEventResult = {
  readonly application: Application
  readonly event: ApplicationEvent
  readonly replayed: boolean
}

export type CreateCampaignCaptureResult = {
  readonly application: Application
  readonly capture: CampaignCapture
  readonly replayed: boolean
}

export type UpsertApplicationInput = ApplicationWritable & {
  readonly compensations?: readonly ApplicationCompensationInput[]
  readonly labels?: readonly string[]
}

export type PatchApplicationInput = ApplicationMutable & {
  readonly expectedVersion?: number
}

export type ListApplicationsInput = ApplicationListQueryRequest & {
  readonly currency?: CurrencyCode | 'original'
}

export type { ApplicationListItem }

/** Cursor page returned by application list operations. */
export type ApplicationListPage = QueryPage<ApplicationListItem, CursorPageInfo>

export type ApplicationFacets = {
  readonly applicationStatuses: readonly ApplicationStatus[]
  readonly companies: readonly string[]
  readonly labels: readonly string[]
  readonly personalPriorities: readonly PersonalPriority[]
  readonly targetStages: readonly TargetStage[]
}

export type AddApplicationNoteInput = Pick<
  ApplicationNote,
  'body' | 'kind' | 'source'
> & {
  readonly operationId: string
}

type CampaignCaptureInputFields = Pick<
  CampaignCapture,
  | 'artifacts'
  | 'audience'
  | 'campaignRunId'
  | 'capturedAt'
  | 'confidence'
  | 'applicationUrl'
  | 'jobContentHash'
  | 'profile'
  | 'submissionDetails'
>

export type CreateCampaignCaptureInput = UpsertApplicationInput &
  CampaignCaptureInputFields & {
    readonly deviceId: string | null
    readonly operationId: string
    readonly identityResolution?: ApplicationIdentityResolution
    readonly fitAssessment?: CampaignCapture['fitAssessment']
  }

export type {
  AppendableApplicationEventKind,
  InformationalApplicationEventKind,
  StatusChangingApplicationEventKind,
}

type AppendApplicationEventInputBase = {
  readonly deviceId: string | null
  readonly expectedVersion: number | null
  readonly occurredAt: string
  readonly operationId: string
  readonly payload: JsonValue
}

export type AppendApplicationEventInput =
  | (AppendApplicationEventInputBase & {
      readonly kind: StatusChangingApplicationEventKind
      readonly nextApplicationStatus: ApplicationStatus
    })
  | (AppendApplicationEventInputBase & {
      readonly kind: InformationalApplicationEventKind
      readonly nextApplicationStatus?: never
    })

export type ListEventsInput = EventListQueryRequest

export type { RegistryEventListItem }

/** Cursor page returned by registry-wide event list operations. */
export type EventListPage = QueryPage<RegistryEventListItem, CursorPageInfo>

export type ConvertedCompensation = {
  readonly currencyCode: CurrencyCode
  readonly maximumMinor: number | null
  readonly minimumMinor: number | null
  readonly observedAt: string
  readonly provider: string
  readonly rate: number
}

export type ApplicationCompensationResultItem = {
  readonly conversion: ConvertedCompensation | null
  readonly original: ApplicationCompensation
}

export type ApplicationCompensationsResult =
  RegistryItems<ApplicationCompensationResultItem>

export type RecordListingObservationInput = {
  readonly mode: ListingCheckMode
  readonly observation: ListingObservation
  readonly operationId: string
  readonly runId?: string
}

export type CheckListingResult = {
  readonly application: Application
  readonly archived: boolean
  readonly check: ApplicationListingCheck
  readonly replayed: boolean
}

export type SubmitListingCheckFinding = {
  readonly applicationId: string
  readonly canonicalUrl: string
  readonly observation: ListingObservation
  readonly operationId: string
  readonly target: ListingCheckTarget
}

export type SubmitListingCheckFindingsInput = {
  readonly expectedCount: number
  readonly finalBatch: boolean
  readonly findings: readonly SubmitListingCheckFinding[]
  readonly mode: ListingCheckMode
  readonly runId: string
  readonly startedAt: string
}

export type SubmitListingCheckFindingsResult = {
  readonly archivedCount: number
  readonly checks: readonly ApplicationListingCheck[]
  readonly rejected: readonly {
    readonly applicationId: string
    readonly message: string
  }[]
  readonly replayedCount: number
  readonly run: ListingCheckRun
}

export type RunDueListingChecksInput = {
  readonly limit: number
  readonly mode: ListingCheckMode
}

export type RunDueListingChecksResult = {
  readonly checks: readonly ApplicationListingCheck[]
  readonly run: ListingCheckRun
}

export type ListingCheckDecision = {
  readonly action: ListingCheckAction
  readonly archiveApplication: boolean
  readonly availability: 'open' | 'suspected_closed' | 'closed' | 'unknown'
  readonly closedCandidateAt: string | null
  readonly consecutiveClosedChecks: number
  readonly nextCheckAt: string
}
