import type {
  Application,
  ApplicationCompensation,
  ApplicationCompensationInput,
  ApplicationEvent,
  ApplicationListingCheck,
  ApplicationListingCheckSchedule,
  ApplicationMutable,
  ApplicationNote,
  ApplicationWritable,
  ContentEntry,
  ContentRevision,
  CvLink,
  FactsRelease,
  FactsReleaseAsset,
  FactsReleaseCatalog,
  GeneratedArtifact,
  JobPostingSnapshot,
  PdfGenerationOutbox,
  ListingAvailability,
  ListingCheckConfidence,
  ListingCheckMode,
  ListingCheckReason,
  ListingCheckRun,
  ListingCheckRunTrigger,
  UtcIsoTimestamp,
} from '@cv/application-registry-entity'
import type {
  AnnualCompensation,
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
  readonly notes: number
}

export type ApplicationListLatestEvent = Pick<
  ApplicationEvent,
  'kind' | 'occurredAt'
>

export type ApplicationListRecord = Application & {
  readonly compensations: readonly ApplicationCompensation[]
  readonly counts: ApplicationListCounts
  readonly identityAliases: readonly string[]
  readonly labels: readonly string[]
  readonly latestEvent: ApplicationListLatestEvent | null
}

export type ApplicationListPage = QueryPage<
  ApplicationListRecord,
  CursorPageInfo
>

export type ApplicationFacets = {
  readonly companies: readonly string[]
  readonly labels: readonly string[]
}

export type EventListPage = QueryPage<RegistryEventListItem, CursorPageInfo>

export type ApplicationPatch = ApplicationMutable & {
  readonly expectedVersion?: number
}

export type PersistedManagedApplicationUpdate = {
  readonly annualCompensation?: {
    readonly replacement: PersistedAnnualCompensation | null
  }
  readonly event: PersistedEvent | undefined
  readonly expectedVersion: number
  readonly labels?: readonly string[]
  readonly operationId: string
  readonly operationRequestSignature: string
  readonly patch: ApplicationMutable
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
  readonly applicationId: string
  readonly compensations?: readonly PersistedCompensation[]
  readonly labels?: readonly string[]
  readonly recordedAt: UtcIsoTimestamp
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
  readonly expectedVersion?: number
  readonly listingAvailability: ListingAvailability
  readonly operationRequestSignature: string
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

export type PersistedFactsRelease = {
  readonly release: FactsRelease
  readonly catalogs: readonly FactsReleaseCatalog[]
  readonly assets: readonly FactsReleaseAsset[]
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
    | 'canonicalUrl'
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
    | 'publishedRevisionId'
    | 'token'
    | 'updatedAt'
  >
  readonly locale: string
}

export type PersistedGeneratedArtifact = GeneratedArtifact

export type PersistedPdfGenerationOutbox = PdfGenerationOutbox

export type PersistedJobPostingSnapshot = JobPostingSnapshot
