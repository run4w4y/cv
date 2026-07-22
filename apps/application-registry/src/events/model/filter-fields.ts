import type { QueryFilterFieldPresentation } from '@cv/drizzle-query-ui'

const timestamp = (
  label: string,
  description: string
): QueryFilterFieldPresentation => ({
  label,
  description,
  defaultOperator: 'gte',
})

export const eventFilterFieldPresentation: Readonly<
  Record<string, QueryFilterFieldPresentation>
> = {
  id: { label: 'Activity ID' },
  applicationId: { label: 'Application ID' },
  kind: {
    label: 'Activity kind',
  },
  revision: { label: 'Registry revision' },
  occurredAt: timestamp('Occurred time', 'When the activity was issued'),
  actor: { label: 'Actor' },
  source: { label: 'Source' },
}
