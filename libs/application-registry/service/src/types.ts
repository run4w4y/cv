import type {
  AppendableApplicationEventKind,
  Application,
  ApplicationCompensation,
  ApplicationCompensationInput,
  ApplicationEvent,
  ApplicationEventKind,
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

export type RegistryPage<A> = {
  readonly checkpoint: string | null
  readonly items: readonly A[]
  readonly nextCursor: string | null
}

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

export type ListApplicationsInput = {
  readonly after?: string
  readonly applicationStatus?: ApplicationStatus | readonly ApplicationStatus[]
  readonly company?: string
  readonly currency?: CurrencyCode | 'original'
  readonly fitScoreMax?: number
  readonly fitScoreMin?: number
  readonly followUpState?: FollowUpState | readonly FollowUpState[]
  readonly label?: string | readonly string[]
  readonly limit?: number
  readonly location?: string
  readonly personalPriority?: PersonalPriority | readonly PersonalPriority[]
  readonly role?: string
  readonly targetStage?: TargetStage | readonly TargetStage[]
  readonly url?: string
}

export type FollowUpState = 'none' | 'overdue' | 'upcoming'

export type ApplicationListItem = Application & {
  readonly captureCount: number
  readonly compensationSummary: string | null
  readonly followUpState: FollowUpState
  readonly labels: readonly string[]
  readonly latestEventAt: string | null
  readonly latestEventKind: ApplicationEventKind | null
  readonly latestApplicationUrl: string | null
  readonly noteCount: number
}

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
  | 'jobContentHash'
  | 'profile'
  | 'submissionDetails'
>

export type CreateCampaignCaptureInput = UpsertApplicationInput &
  CampaignCaptureInputFields & {
    readonly deviceId: string | null
    readonly operationId: string
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

export type ListEventsInput = {
  readonly after?: string
  readonly from?: string
  readonly kind?: ApplicationEventKind | readonly ApplicationEventKind[]
  readonly limit?: number
  readonly to?: string
}

export type RegistryEventListItem = ApplicationEvent & {
  readonly canonicalUrl: string
  readonly company: string
  readonly role: string
}

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
