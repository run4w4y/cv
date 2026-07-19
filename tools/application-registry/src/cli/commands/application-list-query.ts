import type { ListApplicationsQuery } from '@cv/application-registry-api-contract'
import type {
  ApplicationStatus,
  PersonalPriority,
  TargetStage,
} from '@cv/application-registry-entity'
import { compact } from 'es-toolkit/array'

/** Follow-up shortcuts exposed by the CLI. */
export const followUpShortcutValues = ['none', 'overdue', 'upcoming'] as const

/** A CLI-only follow-up shortcut resolved against one client-side instant. */
export type FollowUpShortcut = (typeof followUpShortcutValues)[number]

/** Parsed application-list flags before conversion to the registry query DSL. */
export type ApplicationFilterOptions = {
  readonly after?: string
  readonly applicationStatus?: readonly ApplicationStatus[]
  readonly company?: string
  readonly currency?: ListApplicationsQuery['currency']
  readonly followUpShortcut?: FollowUpShortcut
  readonly label?: readonly string[]
  readonly location?: string
  readonly personalPriority?: readonly PersonalPriority[]
  readonly role?: string
  readonly size?: number
  readonly targetStage?: readonly TargetStage[]
  readonly url?: string
}

type ApplicationFilter = NonNullable<ListApplicationsQuery['filters']>[number]

const followUpFilterByShortcut = {
  none: () => ({
    type: 'condition',
    field: 'followUpAt',
    operator: 'isNull',
  }),
  overdue: (referenceTime) => ({
    type: 'condition',
    field: 'followUpAt',
    operator: 'lt',
    value: referenceTime,
  }),
  upcoming: (referenceTime) => ({
    type: 'condition',
    field: 'followUpAt',
    operator: 'gte',
    value: referenceTime,
  }),
} satisfies Record<
  FollowUpShortcut,
  (referenceTime: string) => ApplicationFilter
>

/** Converts friendly CLI flags into the registry's primitive filter tree. */
export const applicationFilters = (
  options: ApplicationFilterOptions,
  referenceTime: string,
  search?: string
): ListApplicationsQuery['filters'] =>
  compact([
    options.applicationStatus === undefined
      ? undefined
      : {
          type: 'condition' as const,
          field: 'applicationStatus' as const,
          operator: 'in' as const,
          value: options.applicationStatus,
        },
    options.company === undefined
      ? undefined
      : {
          type: 'condition' as const,
          field: 'company' as const,
          operator: 'contains' as const,
          value: options.company,
        },
    options.followUpShortcut === undefined
      ? undefined
      : followUpFilterByShortcut[options.followUpShortcut](referenceTime),
    options.label === undefined
      ? undefined
      : {
          type: 'condition' as const,
          field: 'labels' as const,
          operator: 'hasAny' as const,
          value: options.label,
        },
    options.location === undefined
      ? undefined
      : {
          type: 'condition' as const,
          field: 'location' as const,
          operator: 'contains' as const,
          value: options.location,
        },
    options.personalPriority === undefined
      ? undefined
      : {
          type: 'condition' as const,
          field: 'personalPriority' as const,
          operator: 'in' as const,
          value: options.personalPriority,
        },
    options.role === undefined
      ? undefined
      : {
          type: 'condition' as const,
          field: 'role' as const,
          operator: 'contains' as const,
          value: options.role,
        },
    options.targetStage === undefined
      ? undefined
      : {
          type: 'condition' as const,
          field: 'targetStage' as const,
          operator: 'in' as const,
          value: options.targetStage,
        },
    options.url === undefined
      ? undefined
      : {
          type: 'condition' as const,
          field: 'postingUrl' as const,
          operator: 'contains' as const,
          value: options.url,
        },
    search === undefined
      ? undefined
      : {
          type: 'condition' as const,
          field: 'q' as const,
          operator: 'matches' as const,
          value: search,
        },
  ])

/**
 * Creates cursor-page requests whose filters share one reference timestamp.
 * Reusing the returned function keeps every continuation cursor bound to the
 * same logical query.
 */
export const makeApplicationListQuery = (
  filters: ApplicationFilterOptions,
  options: {
    readonly all: boolean
    readonly referenceTime: string
    readonly search?: string
  }
) => {
  const compiledFilters = applicationFilters(
    filters,
    options.referenceTime,
    options.search
  )

  return (after: string | undefined): ListApplicationsQuery => ({
    currency: filters.currency,
    filters: compiledFilters,
    pagination: {
      after,
      size: options.all ? 100 : filters.size,
    },
  })
}
