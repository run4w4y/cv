import type {
  Application,
  ApplicationActivity,
  ApplicationCompensation,
  ApplicationCompensationInput,
  ApplicationListingCheck,
  ApplicationListingCheckSchedule,
  ApplicationMutable,
  ApplicationNote,
  ApplicationWritable,
  ContentEntry,
  ContentRevision,
  CvLink,
  GeneratedArtifact,
  JobPostingSnapshot,
  ListingAvailability,
  ListingCheckConfidence,
  ListingCheckMode,
  ListingCheckReason,
  ListingCheckRun,
  ListingCheckRunTrigger,
  PdfGenerationOutbox,
  UtcIsoTimestamp,
} from '@cv/application-registry-entity'
import type {
  AnnualCompensation,
  activityListQuery,
  applicationListQuery,
  RegistryActivityListItem,
} from '@cv/application-registry-entity/query'
import type {
  CursorPageInfo,
  QueryPage,
  QueryResolutionOf,
} from '@cv/drizzle-query'

export type ApplicationListResolution = QueryResolutionOf<
  typeof applicationListQuery
>

export type ActivityListResolution = QueryResolutionOf<typeof activityListQuery>

export type ApplicationListCounts = {
  readonly notes: number
}

export type ApplicationListLatestActivity = Pick<
  ApplicationActivity,
  'kind' | 'occurredAt'
>

export type ApplicationListRecord = Application & {
  readonly compensations: readonly ApplicationCompensation[]
  readonly counts: ApplicationListCounts
  readonly labels: readonly string[]
  readonly latestActivity: ApplicationListLatestActivity | null
}

export type ApplicationListPage = QueryPage<
  ApplicationListRecord,
  CursorPageInfo
>

export type ApplicationFacets = {
  readonly companies: readonly string[]
  readonly labels: readonly string[]
}

export type ActivityListPage = QueryPage<
  RegistryActivityListItem,
  CursorPageInfo
>

export type ApplicationPatch = ApplicationMutable & {
  readonly expectedVersion?: number
}

export type PersistedManagedApplicationUpdate = {
  readonly annualCompensation?: {
    readonly replacement: PersistedAnnualCompensation | null
  }
  readonly activity: PersistedActivity
  readonly expectedVersion: number
  readonly labels?: readonly string[]
  readonly idempotencyKey: string
  readonly requestHash: string
  readonly patch: ApplicationMutable
  readonly postingIdentity?: {
    readonly fingerprint: string
    readonly normalizedUrl: string
  }
  readonly recordedAt: UtcIsoTimestamp
}

export type ManagedApplicationUpdateResult = {
  readonly annualCompensation: AnnualCompensation | null
  readonly application: Application
  readonly labels: readonly string[]
}

export interface PersistApplicationOptions {
  readonly operation: string
}

export type PersistedCompensation = ApplicationCompensationInput & {
  readonly id: string
}

export type PersistedAnnualCompensation = Pick<
  ApplicationCompensation,
  | 'currencyCode'
  | 'id'
  | 'kind'
  | 'maximumMinor'
  | 'minimumMinor'
  | 'rawText'
  | 'source'
>

export type PersistedApplication = ApplicationWritable & {
  readonly activity: PersistedActivity
  readonly applicationId: string
  readonly postingFingerprint: string
  readonly postingUrlNormalized: string
  readonly compensations?: readonly PersistedCompensation[]
  readonly labels?: readonly string[]
  readonly recordedAt: UtcIsoTimestamp
}

export type PersistedActivity = Pick<
  ApplicationActivity,
  'actor' | 'kind' | 'occurredAt' | 'payload' | 'source'
> & { readonly activityId: string }

export type PersistedNote = Pick<
  ApplicationNote,
  'body' | 'kind' | 'source'
> & {
  readonly activityId: string
  readonly noteId: string
  readonly idempotencyKey: string
  readonly recordedAt: UtcIsoTimestamp
  readonly requestHash: string
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
  readonly claimedLeaseToken?: string
  readonly closedCandidateAt: string | null
  readonly consecutiveClosedChecks: number
  readonly activityId: string | null
  readonly expectedVersion?: number
  readonly listingAvailability: ListingAvailability
  readonly requestHash: string
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

export type StartedScheduledListingCheckRun = {
  readonly run: ListingCheckRun
  readonly schedules: readonly ClaimedListingCheckSchedule[]
}

export type ListingCheckProjection = {
  readonly availability: ListingAvailability
  readonly checkedAt: string
  readonly closedCandidateAt: string | null
  readonly confidence: ListingCheckConfidence
  readonly consecutiveClosedChecks: number
  readonly reasonCode: ListingCheckReason
}

export type PersistedContentEntry = Omit<
  ContentEntry,
  'approvedRevisionId' | 'headRevisionId' | 'state' | 'version'
>

export type PersistedContentRevision = ContentRevision

export type PersistedCvLink = Omit<
  CvLink,
  'disabledAt' | 'disabledReason' | 'enabled' | 'publicationVersion' | 'version'
>

export type CvAnalyticsLinkRecord = {
  readonly application: Pick<
    Application,
    | 'appliedAt'
    | 'applicationStatus'
    | 'postingUrl'
    | 'company'
    | 'createdAt'
    | 'id'
    | 'listingAvailability'
    | 'role'
  >
  readonly labels: readonly string[]
  readonly link: Pick<
    CvLink,
    | 'contentEntryId'
    | 'createdAt'
    | 'enabled'
    | 'id'
    | 'currentRevisionId'
    | 'token'
    | 'updatedAt'
  >
  readonly locale: string
}

export type PersistedGeneratedArtifact = GeneratedArtifact

export type PersistedPdfGenerationOutbox = PdfGenerationOutbox

export type PersistedJobPostingSnapshot = JobPostingSnapshot
