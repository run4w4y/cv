import type { ArtifactMetadata } from '@cv/application-registry-artifact-store'
import type {
  Application,
  ApplicationCompensation,
  ApplicationCompensationInput,
  ApplicationLabel,
  ApplicationListingCheck,
  ApplicationMutable,
  ApplicationNote,
  ApplicationWritable,
  ContentEntry,
  ContentEntryKind,
  ContentRevision,
  ContentRevisionSource,
  CvLink,
  GeneratedArtifact,
  JobSnapshotStatus,
  ListingCheckAction,
  ListingCheckMode,
  ListingCheckRun,
  ListingCheckTarget,
  ListingObservation,
} from '@cv/application-registry-entity'
import type {
  ActivityListQueryRequest,
  AnnualCompensation,
  ApplicationListItem,
  ApplicationListQueryRequest,
  RegistryActivityListItem,
} from '@cv/application-registry-entity/query'
import type { CursorPageInfo, QueryPage } from '@cv/drizzle-query'

export type RegistryItems<A> = { readonly items: readonly A[] }

export type CvAnalyticsDays = 1 | 3 | 7

export type CvAnalyticsRangeInput = {
  readonly days?: CvAnalyticsDays
  readonly from?: string
  readonly to?: string
}

export type CvAnalyticsTrafficCapabilities = {
  readonly retentionMs: number
}

export type CvAnalyticsAvailability = {
  readonly from: string
  readonly to: string
}

export type CvAnalyticsTotals = {
  readonly pageViews: number
  readonly visits: number
}

export type CvAnalyticsSeriesPoint = CvAnalyticsTotals & {
  readonly at: string
}

export type CvAnalyticsCountry = {
  readonly name: string
  readonly visits: number
}

export type CvAnalyticsTrafficAlias = {
  readonly key: string
  readonly path: string
}

export type CvAnalyticsTrafficRecord = {
  readonly countries: Readonly<Record<string, number>>
  readonly key: string
  readonly series: readonly CvAnalyticsSeriesPoint[]
  readonly totals: CvAnalyticsTotals
}

export type CvAnalyticsTrafficData = {
  readonly generatedAt: string
  readonly range: {
    readonly from: string
    readonly granularity: 'day'
    readonly to: string
  }
  readonly records: readonly CvAnalyticsTrafficRecord[]
}

export type CvAnalyticsItem = {
  readonly application: Pick<
    Application,
    | 'appliedAt'
    | 'applicationStatus'
    | 'company'
    | 'createdAt'
    | 'id'
    | 'listingAvailability'
    | 'postingUrl'
    | 'role'
  >
  readonly countries: readonly CvAnalyticsCountry[]
  readonly firstSeenOn: string | null
  readonly labels: readonly string[]
  readonly lastSeenOn: string | null
  readonly link: Pick<
    CvLink,
    'contentEntryId' | 'createdAt' | 'enabled' | 'id' | 'updatedAt'
  > & { readonly locale: string }
  readonly series: readonly CvAnalyticsSeriesPoint[]
  readonly totals: CvAnalyticsTotals
}

export type CvAnalyticsResult = {
  readonly availability: CvAnalyticsAvailability
  readonly countries: readonly CvAnalyticsCountry[]
  readonly generatedAt: string
  readonly items: readonly CvAnalyticsItem[]
  readonly range: CvAnalyticsTrafficData['range']
  readonly series: readonly CvAnalyticsSeriesPoint[]
  readonly summary: {
    readonly enabledLinks: number
    readonly pageViews: number
    readonly publishedLinks: number
    readonly unviewedLinks: number
    readonly viewedLinks: number
    readonly visits: number
  }
}

export type ApplicationAnnotations = {
  readonly labels: readonly ApplicationLabel[]
  readonly notes: readonly ApplicationNote[]
}

export type AddApplicationNoteResult = {
  readonly note: ApplicationNote
  readonly replayed: boolean
}

export type CreateApplicationInput = ApplicationWritable & {
  readonly compensations?: readonly ApplicationCompensationInput[]
  readonly labels?: readonly string[]
}

export type UpdateApplicationInput = ApplicationMutable & {
  readonly annualCompensation?: AnnualCompensation | null
  readonly expectedVersion: number
  readonly idempotencyKey: string
  readonly labels?: readonly string[]
}

export type UpdateApplicationResult = {
  readonly annualCompensation: AnnualCompensation | null
  readonly application: Application
  readonly labels: readonly string[]
}

export type ListApplicationsInput = ApplicationListQueryRequest & {
  readonly q?: string
}

export type { ApplicationListItem }

/** Cursor page returned by application list operations. */
export type ApplicationListPage = QueryPage<ApplicationListItem, CursorPageInfo>

export type ApplicationFacets = {
  readonly companies: readonly string[]
  readonly labels: readonly string[]
}

export type AddApplicationNoteInput = Pick<
  ApplicationNote,
  'body' | 'kind' | 'source'
> & {
  readonly idempotencyKey: string
}

export type ListActivitiesInput = ActivityListQueryRequest

export type { RegistryActivityListItem }

/** Cursor page returned by registry-wide activity list operations. */
export type ActivityListPage = QueryPage<
  RegistryActivityListItem,
  CursorPageInfo
>

export type ApplicationCompensationsResult =
  RegistryItems<ApplicationCompensation>

export type ReplaceAnnualCompensationInput = {
  readonly annualCompensation: AnnualCompensation | null
  readonly expectedVersion: number
}

export type ReplaceAnnualCompensationResult = {
  readonly annualCompensation: AnnualCompensation | null
  readonly application: Application
}

export type RecordListingObservationInput = {
  readonly expectedVersion?: number
  readonly mode: ListingCheckMode
  readonly observation: ListingObservation
  readonly idempotencyKey: string
  readonly requestHash: string
  readonly runId?: string
}

export type CheckListingResult = {
  readonly application: Application
  readonly archived: boolean
  readonly check: ApplicationListingCheck
  readonly replayed: boolean
}

export type ResolveListingAvailabilityInput = {
  readonly expectedVersion: number
  readonly idempotencyKey: string
  readonly resolution: 'open' | 'closed'
}

export type SubmitListingCheckFinding = {
  readonly applicationId: string
  readonly postingUrl: string
  readonly observation: ListingObservation
  readonly idempotencyKey: string
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
  readonly run: ListingCheckRun | null
}

export type ListingCheckDecision = {
  readonly action: ListingCheckAction
  readonly archiveApplication: boolean
  readonly availability: 'open' | 'suspected_closed' | 'closed' | 'unknown'
  readonly closedCandidateAt: string | null
  readonly consecutiveClosedChecks: number
  readonly nextCheckAt: string
}

/** Opaque bytes accompanied only by transport metadata. */
export type OpaquePayloadInput = {
  readonly bytes: Uint8Array
  readonly mediaType: string
}

/** Content-addressed metadata for bytes whose application shape is unknown. */
export type OpaqueObjectMetadata = ArtifactMetadata

type PersistJobPostingSnapshotInputBase = {
  readonly fetcherVersion: string
  readonly finalUrl: string | null
  readonly normalized?: OpaquePayloadInput | null
  readonly raw?: OpaquePayloadInput | null
  readonly requestedUrl: string
}

export type PersistJobPostingSnapshotInput =
  | (PersistJobPostingSnapshotInputBase & {
      readonly errorCode?: never
      readonly errorMessage?: never
      readonly status: Exclude<JobSnapshotStatus, 'failed'>
    })
  | (PersistJobPostingSnapshotInputBase & {
      readonly errorCode: string
      readonly errorMessage: string
      readonly status: Extract<JobSnapshotStatus, 'failed'>
    })

export type JobPostingSnapshotPayloadKind = 'normalized' | 'raw'

export type CreateContentEntryInput = {
  readonly kind: ContentEntryKind
  readonly locale: string
}

export type AppendContentRevisionInput = {
  readonly contractId: string
  readonly contractVersion: string
  readonly expectedVersion: number
  readonly factsReleaseId?: string | null
  readonly jobSnapshotId?: string | null
  readonly operationId: string
  readonly payload: OpaquePayloadInput
  readonly source: ContentRevisionSource
}

export type ContentRevisionResult = {
  readonly entry: ContentEntry
  readonly revision: ContentRevision
}

export type OpaqueContentRevision = ContentRevisionResult & {
  readonly bytes: Uint8Array
}

export type ApproveContentRevisionInput = {
  readonly expectedVersion: number
  readonly revisionId: string
}

export type StageCvInput = {
  readonly expectedContentVersion: number
  readonly operationId: string
  readonly publicBaseUrl: string
  readonly revisionId: string
}

export type ResolvedCvPublication = {
  readonly bytes: Uint8Array
  readonly entry: ContentEntry
  readonly link: CvLink
  readonly revision: ContentRevision
}

export type SetCvLinkAvailabilityInput = {
  readonly enabled: boolean
  readonly expectedPublicationVersion: number
  readonly operationId: string
  readonly reason?: string
}

export type RequestPdfGenerationInput = {
  readonly expectedPublicationVersion: number
  readonly operationId: string
}

export type PdfGenerationAttempt = {
  readonly artifact: GeneratedArtifact
  readonly entry: ContentEntry
  readonly link: CvLink
  readonly revision: ContentRevision
}

export type ReadyPdfArtifact = {
  readonly artifact: GeneratedArtifact
  readonly bytes: Uint8Array
}
