import { Skeleton } from '@cv/internal-ui'
import { MonitorUp } from 'lucide-react'

export const CvWebPreview = ({
  loading = false,
  url,
}: {
  readonly loading?: boolean
  readonly url: string | null
}) =>
  loading ? (
    <div
      aria-label="Loading saved CV preview"
      className="mx-auto min-h-[42rem] w-full max-w-6xl rounded-lg border border-border bg-white p-10 shadow-sm"
      role="status"
    >
      <Skeleton className="h-8 w-2/5" />
      <Skeleton className="mt-3 h-4 w-3/5" />
      <Skeleton className="mt-10 h-3 w-full" />
      <Skeleton className="mt-3 h-3 w-11/12" />
      <Skeleton className="mt-3 h-3 w-4/5" />
      <Skeleton className="mt-12 h-4 w-1/4" />
      <Skeleton className="mt-5 h-28 w-full" />
      <Skeleton className="mt-8 h-28 w-full" />
    </div>
  ) : url === null ? (
    <div className="mx-auto grid min-h-[32rem] w-full max-w-5xl place-items-center rounded-lg border border-dashed border-border bg-card">
      <div className="grid max-w-sm justify-items-center gap-3 px-6 text-center">
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <MonitorUp className="size-5" />
        </span>
        <div>
          <p className="text-sm font-medium">Preview follows the saved draft</p>
          <p className="mt-1 text-sm/6 text-muted-foreground">
            Save this CV to stage its private web page, then return here to
            inspect the exact renderer used by the published CV.
          </p>
        </div>
        <div className="mt-3 grid w-full gap-2" aria-hidden>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-10/12 justify-self-center" />
          <Skeleton className="h-3 w-8/12 justify-self-center" />
        </div>
      </div>
    </div>
  ) : (
    <div className="mx-auto h-[calc(100vh-8rem)] min-h-[42rem] w-full max-w-6xl overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <iframe
        className="size-full border-0 bg-white"
        referrerPolicy="no-referrer"
        sandbox="allow-same-origin"
        src={url}
        title="Saved CV web preview"
      />
    </div>
  )
