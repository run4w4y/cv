import { Button, Skeleton } from '@cv/internal-ui'
import { ArrowLeft, CircleAlert } from 'lucide-react'
import { Link } from 'react-router'

import { HeaderActions } from '@/shell/header-actions'

export const DocumentWorkspaceSkeleton = ({
  label = 'Loading document workspace',
}: {
  readonly label?: string
}) => (
  <section
    aria-busy="true"
    aria-label={label}
    className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-background"
  >
    <HeaderActions>
      <Skeleton className="h-8 w-28" />
      <Skeleton className="size-8" />
      <Skeleton className="size-8" />
      <Skeleton className="h-8 w-24" />
    </HeaderActions>

    <main className="min-h-0 min-w-0 flex-1 overflow-hidden bg-muted/35 p-4 sm:p-6">
      <div className="mx-auto min-h-full w-full max-w-4xl bg-card px-8 py-10 shadow-sm ring-1 ring-border sm:px-12 lg:px-16">
        <Skeleton className="h-9 w-2/5" />
        <Skeleton className="mt-2 h-5 w-3/5" />
        <Skeleton className="mt-2 h-3 w-1/3" />
        <div className="mt-6 grid gap-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-4/5" />
        </div>
        {[0, 1, 2].map((section) => (
          <div className="mt-9" key={section}>
            <div className="flex items-end justify-between border-b border-border pb-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-6 w-36" />
            </div>
            {[0, 1].map((row) => (
              <div className="border-b border-border/70 py-5" key={row}>
                <Skeleton className="h-5 w-2/5" />
                <Skeleton className="mt-2 h-3 w-full" />
                <Skeleton className="mt-2 h-3 w-10/12" />
                <Skeleton className="mt-4 h-8 w-3/4" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>

    <aside className="flex min-h-0 w-80 shrink-0 flex-col border-l border-border bg-card xl:w-96">
      <div className="grid grid-cols-3 gap-1 border-b border-border p-3">
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
      </div>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Skeleton className="size-4" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="grid flex-1 content-start gap-3 px-4 py-5">
        <Skeleton className="h-3 w-11/12" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="mt-2 h-3 w-10/12" />
      </div>
      <div className="border-t border-border p-3">
        <Skeleton className="h-24 rounded-xl" />
      </div>
    </aside>
  </section>
)

export const DocumentWorkspaceError = ({
  backTo,
  description,
  title,
}: {
  readonly backTo: string
  readonly description: string
  readonly title: string
}) => (
  <section className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-y-auto bg-background p-6">
    <div
      className="w-full max-w-lg rounded-lg border border-destructive/20 bg-card p-6 shadow-sm"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="min-w-0">
          <h1 className="font-semibold">{title}</h1>
          <p className="mt-1 text-sm/6 text-muted-foreground">{description}</p>
          <Button
            className="mt-5"
            nativeButton={false}
            render={<Link to={backTo} />}
            size="sm"
            variant="outline"
          >
            <ArrowLeft />
            Return to workflow
          </Button>
        </div>
      </div>
    </div>
  </section>
)
