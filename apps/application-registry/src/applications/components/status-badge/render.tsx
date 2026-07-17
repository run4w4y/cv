import type {
  ApplicationStatus,
  ListingAvailability,
} from '@cv/application-registry-entity'
import { Badge, type BadgeProps } from '@cv/internal-ui'

import { formatLabel } from '../../../lib/format'

export type StatusBadgeValue = ApplicationStatus | ListingAvailability

type StatusBadgeVariant = NonNullable<BadgeProps['variant']>

const variantByValue = {
  not_started: 'outline',
  preparing: 'warning',
  applied: 'success',
  recruiter_screen: 'warning',
  technical_screen: 'warning',
  take_home: 'warning',
  interview_loop: 'warning',
  paused: 'outline',
  offer: 'success',
  rejected: 'danger',
  withdrawn: 'danger',
  archived: 'danger',
  unchecked: 'outline',
  open: 'success',
  suspected_closed: 'warning',
  closed: 'danger',
  unknown: 'outline',
} satisfies Record<StatusBadgeValue, StatusBadgeVariant>

export const statusBadgeVariant = (
  value: StatusBadgeValue
): StatusBadgeVariant => variantByValue[value]

export const StatusBadge = ({
  value,
}: {
  readonly value: StatusBadgeValue
}) => <Badge variant={statusBadgeVariant(value)}>{formatLabel(value)}</Badge>
