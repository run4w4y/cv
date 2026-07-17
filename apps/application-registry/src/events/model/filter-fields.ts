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
  id: { label: 'Event ID' },
  applicationId: { label: 'Application ID' },
  kind: {
    label: 'Event kind',
  },
  revision: { label: 'Registry revision' },
  occurredAt: timestamp(
    'Occurred time',
    'When the event happened at its source'
  ),
  recordedAt: timestamp(
    'Recorded time',
    'When the event was committed to the registry'
  ),
  deviceId: { label: 'Device ID' },
  operationId: { label: 'Operation ID' },
}
