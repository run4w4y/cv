import type {
  AppendableApplicationEventKind,
  Application,
  ApplicationCompensation,
  ApplicationCompensationInput,
  ApplicationEvent,
  ApplicationEventKind,
  ApplicationLabel,
  ApplicationMutable,
  ApplicationNote,
  ApplicationStatus,
  ApplicationWritable,
  CampaignCapture,
  CurrencyCode,
  InformationalApplicationEventKind,
  JsonValue,
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
