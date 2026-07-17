import { Button } from '@cv/internal-ui'
import { Archive, CheckCircle2, RotateCcw } from 'lucide-react'

import { formatLabel } from '../../../lib/format'
import type { ListingResolution } from './use-review'

export const ListingResolutionOptions = ({
  applicationStatus,
  archivesApplication,
  blocked,
  saving,
  onResolve,
}: {
  readonly applicationStatus: string
  readonly archivesApplication: boolean
  readonly blocked: boolean
  readonly saving: ListingResolution | undefined
  readonly onResolve: (resolution: ListingResolution) => void
}) => (
  <div className="grid gap-3 sm:grid-cols-2">
    <Button
      type="button"
      variant="outline"
      disabled={blocked}
      className="h-auto min-h-28 flex-col items-start justify-start whitespace-normal border-emerald-300 p-4 text-left hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/40"
      onClick={() => onResolve('open')}
    >
      <span className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
        {saving === 'open' ? (
          <RotateCcw className="animate-spin" />
        ) : (
          <CheckCircle2 />
        )}
        Mark open
      </span>
      <span className="text-xs/5 font-normal text-muted-foreground">
        Clears the suspected closure and resumes the normal check schedule. The
        application stage stays unchanged.
      </span>
    </Button>
    <Button
      type="button"
      variant="destructive"
      disabled={blocked}
      className="h-auto min-h-28 flex-col items-start justify-start whitespace-normal border border-destructive/30 p-4 text-left"
      onClick={() => onResolve('closed')}
    >
      <span className="flex items-center gap-2">
        {saving === 'closed' ? (
          <RotateCcw className="animate-spin" />
        ) : (
          <Archive />
        )}
        {archivesApplication ? 'Confirm closed & archive' : 'Confirm closed'}
      </span>
      <span className="text-xs/5 font-normal text-muted-foreground">
        {archivesApplication
          ? 'Records a confirmed closure and archives this unsubmitted application.'
          : `Records a confirmed closure. The ${formatLabel(applicationStatus)} application stage stays unchanged.`}
      </span>
    </Button>
  </div>
)
