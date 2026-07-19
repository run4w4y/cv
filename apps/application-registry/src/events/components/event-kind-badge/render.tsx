import { Badge, type BadgeProps } from '@cv/internal-ui'

import { formatLabel } from '../../../lib/format'

const variantForKind = (kind: string): NonNullable<BadgeProps['variant']> => {
  switch (kind) {
    case 'application_created':
    case 'content_approved':
      return 'success'
    case 'listing_availability_changed':
      return 'danger'
    case 'follow_up_changed':
    case 'status_changed':
      return 'warning'
    case 'note_added':
    case 'details_changed':
      return 'secondary'
    default:
      return 'outline'
  }
}

export const EventKindBadge = ({ kind }: { readonly kind: string }) => (
  <Badge
    variant={variantForKind(kind)}
    className="max-w-full whitespace-normal text-center"
  >
    {formatLabel(kind)}
  </Badge>
)
