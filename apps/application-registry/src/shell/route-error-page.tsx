import { buttonVariants, cn } from '@cv/internal-ui'
import { AlertTriangle } from 'lucide-react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

export const RouteErrorPage = () => {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'The application could not render this route.'

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="max-w-md rounded-lg border border-border bg-card p-6 text-center">
        <AlertTriangle className="mx-auto size-8 text-destructive" />
        <h1 className="mt-4 text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <Link
          to="/applications"
          className={cn(buttonVariants(), 'mt-5 inline-flex')}
        >
          Return to applications
        </Link>
      </div>
    </main>
  )
}
