import * as React from 'react'

const DesktopPreparationWorkflowProvider =
  import.meta.env.MODE === 'desktop'
    ? React.lazy(() =>
        import('../preparation/workflow/provider').then(
          ({ PreparationWorkflowProvider }) => ({
            default: PreparationWorkflowProvider,
          })
        )
      )
    : null

/**
 * Keeps the desktop-only in-memory workflow engine out of the hosted app's
 * startup graph. Desktop loads it once the host connection is ready.
 */
export const HostPreparationWorkflowProvider = ({
  children,
}: React.PropsWithChildren) => {
  if (DesktopPreparationWorkflowProvider === null) return children

  return (
    <React.Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-muted/40 p-4 text-sm text-muted-foreground">
          Starting local preparation workflows…
        </main>
      }
    >
      <DesktopPreparationWorkflowProvider>
        {children}
      </DesktopPreparationWorkflowProvider>
    </React.Suspense>
  )
}
