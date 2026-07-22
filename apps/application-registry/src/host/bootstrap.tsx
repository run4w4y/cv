import type { DesktopRegistryConfiguration } from '@cv/application-registry-desktop-contract'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cv/internal-ui'
import { CircleAlert, Database, LoaderCircle } from 'lucide-react'
import * as React from 'react'

import { desktopBridge } from './desktop'
import { RegistryConnectionForm } from './registry-connection-form'

type BootstrapState =
  | { readonly kind: 'checking' }
  | { readonly error: string; readonly kind: 'check-failed' }
  | { readonly kind: 'ready' }
  | {
      readonly configuration: DesktopRegistryConfiguration
      readonly kind: 'setup'
    }

export const HostBootstrap = ({ children }: React.PropsWithChildren) => {
  const bridge = desktopBridge()
  const [state, setState] = React.useState<BootstrapState>(() =>
    bridge === null ? { kind: 'ready' } : { kind: 'checking' }
  )
  const [checkAttempt, setCheckAttempt] = React.useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: the attempt counter intentionally retries the host request.
  React.useEffect(() => {
    if (bridge === null) return
    let active = true
    void bridge.registry
      .status()
      .then((result) => {
        if (!active) return
        if (result.ok && result.value.configured) {
          setState({ kind: 'ready' })
          return
        }
        if (!result.ok) {
          setState({ error: result.error.message, kind: 'check-failed' })
          return
        }
        setState({ configuration: result.value, kind: 'setup' })
      })
      .catch((error: unknown) => {
        if (!active) return
        setState({
          error:
            error instanceof Error
              ? error.message
              : 'The desktop host did not answer.',
          kind: 'check-failed',
        })
      })
    return () => {
      active = false
    }
  }, [bridge, checkAttempt])

  if (state.kind === 'ready') return children

  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-4" />
            Connect the desktop registry
          </CardTitle>
          <CardDescription>
            The desktop app talks to the deployed Registry API. Its bearer token
            crosses the narrow desktop bridge only when submitted and is then
            saved with operating-system credential encryption.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state.kind === 'checking' ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading local configuration…
            </p>
          ) : state.kind === 'check-failed' ? (
            <div className="grid gap-4">
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Could not load desktop settings</AlertTitle>
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
              <Button
                onClick={() => {
                  setState({ kind: 'checking' })
                  setCheckAttempt((attempt) => attempt + 1)
                }}
                type="button"
              >
                Retry
              </Button>
            </div>
          ) : (
            <RegistryConnectionForm
              key={`${state.configuration.source}:${state.configuration.origin ?? ''}`}
              configuration={state.configuration}
              onConfigured={() => setState({ kind: 'ready' })}
              submitLabel="Test, save, and open Registry"
            />
          )}
        </CardContent>
      </Card>
    </main>
  )
}
