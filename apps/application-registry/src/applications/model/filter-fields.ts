import type { ApplicationFacetsResponse } from '@cv/application-registry-api-contract'
import type { QueryFilterFieldPresentation } from '@cv/drizzle-query-ui'

const options = (values: readonly string[]) =>
  values.map((value) => ({ label: value, value }))

const timestamp = (
  label: string,
  description: string
): QueryFilterFieldPresentation => ({
  label,
  description,
  defaultOperator: 'gte',
})

export const createApplicationFilterFieldPresentation = (
  facets?: ApplicationFacetsResponse
): Readonly<Record<string, QueryFilterFieldPresentation>> => ({
  q: { hidden: true },
  applicationStatus: {
    label: 'Application status',
  },
  appliedAt: timestamp('Applied time', 'When the application was submitted'),
  canonicalUrl: { label: 'Canonical URL' },
  company: {
    label: 'Company',
    options: options(facets?.companies ?? []),
  },
  captureCount: { label: 'Capture count' },
  createdAt: timestamp('Created time', 'When the registry record was created'),
  fitScore: { label: 'Fit score' },
  followUpAt: timestamp(
    'Follow-up time',
    'Scheduled application follow-up timestamp'
  ),
  identityAliases: { label: 'Identity aliases' },
  labels: {
    label: 'Labels',
    options: options(facets?.labels ?? []),
  },
  lastContactAt: timestamp(
    'Last contact time',
    'Most recent candidate or company contact'
  ),
  latestEventAt: timestamp(
    'Latest event time',
    'Timestamp of the latest registry event'
  ),
  latestEventKind: { label: 'Latest event kind' },
  listingAvailability: { label: 'Listing availability' },
  listingCheckedAt: timestamp(
    'Listing checked time',
    'Most recent listing availability check'
  ),
  listingClosedCandidateAt: timestamp(
    'Listing closure candidate time',
    'When the listing first appeared to be closed'
  ),
  noteCount: { label: 'Note count' },
  personalPriority: {
    label: 'Personal priority',
  },
  sourceJobId: { label: 'Source job ID' },
  targetStage: {
    label: 'Target stage',
  },
  updatedAt: timestamp(
    'Updated time',
    'When the application record was last updated'
  ),
  updatedRevision: { label: 'Registry revision' },
})
