import type { Application } from '@cv/application-registry-entity'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  buttonVariants,
  cn,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@cv/internal-ui'
import { AlertCircle, ChevronDown, ExternalLink, RotateCcw } from 'lucide-react'

import { formatDateTime, formatLabel } from '../../../lib/format'
import { ListingResolutionOptions } from './resolution-options'
import { StatusBadge } from '../status-badge'
import {
  type SaveListingResolution,
  useListingAvailabilityReview,
} from './use-review'

export const ListingAvailabilityReviewDialog = ({
  application,
  onResolved,
  saveResolution,
}: {
  readonly application: Application
  readonly onResolved?: (application: Application) => void
  readonly saveResolution?: SaveListingResolution
}) => {
  const review = useListingAvailabilityReview({
    application,
    onResolved,
    saveResolution,
  })

  return (
    <Dialog open={review.open} onOpenChange={review.onOpenChange}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto max-w-full gap-1.5 px-1.5 py-1"
            aria-label={`Review listing availability for ${application.company}: ${formatLabel(application.listingAvailability)}`}
          >
            <StatusBadge value={application.listingAvailability} />
            {application.listingAvailability === 'suspected_closed' ? (
              <span className="text-xs text-amber-700 dark:text-amber-300">
                Review
              </span>
            ) : null}
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        }
      />
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Review listing availability</DialogTitle>
          <DialogDescription>
            Confirm whether {application.company} is still accepting
            applications for {application.role}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 p-3">
            <span className="text-xs font-medium text-muted-foreground">
              Current result
            </span>
            <StatusBadge value={application.listingAvailability} />
            <span className="ml-auto text-xs text-muted-foreground">
              Checked {formatDateTime(application.listingCheckedAt)}
            </span>
            {application.listingReasonCode === null ? null : (
              <span className="w-full text-xs text-muted-foreground">
                Signal: {formatLabel(application.listingReasonCode)}
              </span>
            )}
          </div>

          <a
            href={application.canonicalUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'w-full justify-between'
            )}
          >
            Open the listing before deciding
            <ExternalLink />
          </a>

          <ListingResolutionOptions
            applicationStatus={application.applicationStatus}
            archivesApplication={review.archivesApplication}
            blocked={
              review.saving !== undefined || review.conflict || review.reloading
            }
            saving={review.saving}
            onResolve={review.resolve}
          />

          {review.error === undefined ? null : (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Could not save the review</AlertTitle>
              <AlertDescription className="whitespace-normal break-words">
                {review.error}
              </AlertDescription>
              {review.conflict ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 w-fit"
                  disabled={review.reloading}
                  onClick={review.reloadLatest}
                >
                  <RotateCcw
                    className={review.reloading ? 'animate-spin' : ''}
                  />
                  {review.reloading
                    ? 'Reloading…'
                    : 'Reload latest application'}
                </Button>
              ) : null}
            </Alert>
          )}
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button
                type="button"
                variant="outline"
                disabled={review.saving !== undefined || review.reloading}
              >
                Keep current result
              </Button>
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
