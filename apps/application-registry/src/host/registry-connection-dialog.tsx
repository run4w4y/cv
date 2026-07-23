import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@cv/internal-ui'
import {
  CircleAlert,
  Database,
  LoaderCircle,
  LockKeyhole,
  Settings2,
  TriangleAlert,
} from 'lucide-react'
import * as React from 'react'

import {
  type RegistryConnectionConfiguration,
  registryConnection,
} from './registry-connection'
import { RegistryConnectionForm } from './registry-connection-form'

const defaultReload = () => globalThis.location.reload()

export const RegistryConnectionControl = ({
  reload = defaultReload,
}: {
  readonly reload?: () => void
} = {}) => {
  const connection = React.useMemo(registryConnection, [])
  const requestId = React.useRef(0)
  const [open, setOpen] = React.useState(false)
  const [configuration, setConfiguration] =
    React.useState<RegistryConnectionConfiguration | null>(() =>
      connection.current()
    )
  const [loading, setLoading] = React.useState(configuration === null)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(() => {
    const activeRequest = requestId.current + 1
    requestId.current = activeRequest
    setLoading(true)
    setError(null)
    void connection
      .status()
      .then((nextConfiguration) => {
        if (requestId.current !== activeRequest) return
        setConfiguration(nextConfiguration)
      })
      .catch((cause: unknown) => {
        if (requestId.current !== activeRequest) return
        setError(
          cause instanceof Error
            ? cause.message
            : 'The Registry connection could not be loaded.'
        )
      })
      .finally(() => {
        if (requestId.current === activeRequest) setLoading(false)
      })
  }, [connection])

  React.useEffect(() => {
    refresh()
    return () => {
      requestId.current += 1
    }
  }, [refresh])

  const secondaryLabel =
    error !== null && configuration === null
      ? 'Connection unavailable'
      : loading && configuration === null
        ? 'Loading connection…'
        : (configuration?.origin ?? 'Configure connection')

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) refresh()
      }}
    >
      <DialogTrigger
        render={
          <button
            aria-label="Open Registry connection settings"
            className="group flex h-14 w-full items-center gap-3 rounded-md px-2 text-left outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/30"
            type="button"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
              <Database className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                Registry
              </span>
              <span
                className="block truncate text-xs text-muted-foreground"
                title={configuration?.origin ?? undefined}
              >
                {secondaryLabel}
              </span>
            </span>
            <Settings2 className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
          </button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registry connection</DialogTitle>
          <DialogDescription>
            Choose the Registry API used for authenticated application data.
            {connection.kind === 'desktop'
              ? ' Stored tokens remain inside the desktop main process.'
              : ' Browser overrides are saved in this browser.'}
          </DialogDescription>
        </DialogHeader>

        {loading && configuration === null ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Loading Registry settings…
          </p>
        ) : error !== null ? (
          <div className="grid gap-4">
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>Could not load Registry settings</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <DialogFooter>
              <Button onClick={refresh} type="button" variant="outline">
                Retry
              </Button>
            </DialogFooter>
          </div>
        ) : configuration?.editable === false ? (
          <div className="grid gap-4">
            <div className="grid gap-1 rounded-md border border-border bg-muted/30 p-3">
              <span className="text-xs font-medium text-muted-foreground">
                Registry API base URL
              </span>
              <span className="break-all text-sm">{configuration.origin}</span>
            </div>
            <Alert>
              <LockKeyhole />
              <AlertTitle>Managed by the environment</AlertTitle>
              <AlertDescription>
                REGISTRY_API_URL and REGISTRY_API_TOKEN own this connection.
                Update both variables and restart the desktop app to change it.
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button onClick={() => setOpen(false)} type="button">
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : configuration === null ? null : (
          <div className="grid gap-4">
            <Alert>
              <TriangleAlert />
              <AlertTitle>Changing connections reloads the app</AlertTitle>
              <AlertDescription>
                A reload prevents cached data from the previous Registry being
                mixed with the new connection. In-progress local workflows will
                be reset.
              </AlertDescription>
            </Alert>
            <RegistryConnectionForm
              key={`${configuration.source}:${configuration.origin ?? ''}`}
              connection={connection}
              configuration={configuration}
              onCancel={() => setOpen(false)}
              onConfigured={(nextConfiguration) => {
                setConfiguration(nextConfiguration)
                setOpen(false)
                reload()
              }}
              submitLabel="Test and save"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
