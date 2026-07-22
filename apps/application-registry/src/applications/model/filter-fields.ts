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
  postingUrl: { label: 'Posting URL' },
  company: {
    label: 'Company',
    options: options(facets?.companies ?? []),
  },
  createdAt: timestamp('Created time', 'When the registry record was created'),
  followUpAt: timestamp(
    'Follow-up time',
    'Scheduled application follow-up timestamp'
  ),
  labels: {
    label: 'Labels',
    options: options(facets?.labels ?? []),
  },
  latestActivityAt: timestamp(
    'Latest activity time',
    'Timestamp of the latest backend-issued activity'
  ),
  latestActivityKind: { label: 'Latest activity kind' },
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
  targetStage: {
    label: 'Target stage',
  },
  updatedAt: timestamp(
    'Updated time',
    'When the application record was last updated'
  ),
  updatedRevision: { label: 'Registry revision' },
})
