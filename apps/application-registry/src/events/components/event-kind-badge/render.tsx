import { Badge, type BadgeProps } from '@cv/internal-ui'

import { formatLabel } from '../../../lib/format'

const variantForKind = (kind: string): NonNullable<BadgeProps['variant']> => {
  switch (kind) {
    case 'submitted':
    case 'interview_scheduled':
    case 'offer_received':
      return 'success'
    case 'rejected':
    case 'withdrawn':
    case 'listing_closed':
      return 'danger'
    case 'follow_up_scheduled':
    case 'stage_changed':
      return 'warning'
    case 'contact_logged':
    case 'note_added':
    case 'research_updated':
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
