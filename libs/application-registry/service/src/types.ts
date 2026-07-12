import type {
  AppendableApplicationEventKind,
  Application,
  ApplicationCompensation,
  ApplicationCompensationInput,
  ApplicationEvent,
  ApplicationLabel,
  ApplicationMutable,
  ApplicationNote,
  ApplicationStatus,
  ApplicationWritable,
  CampaignCapture,
  CurrencyCode,
  InformationalApplicationEventKind,
  JsonValue,
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
  readonly applicationStatus?: ApplicationStatus
  readonly company?: string
  readonly label?: string
  readonly limit?: number
  readonly targetStage?: TargetStage
  readonly url?: string
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
  readonly limit?: number
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
