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

import {
  type RegistryConnection,
  type RegistryConnectionConfiguration,
  RegistryConnectionError,
  registryConnection,
} from './registry-connection'
import { RegistryConnectionForm } from './registry-connection-form'

type BootstrapState =
  | { readonly kind: 'checking' }
  | { readonly error: string; readonly kind: 'check-failed' }
  | { readonly kind: 'ready' }
  | {
      readonly configuration: RegistryConnectionConfiguration
      readonly kind: 'setup'
      readonly warning?: string
    }

const repairConfiguration: RegistryConnectionConfiguration = {
  configured: false,
  editable: true,
  origin: null,
  resettable: false,
  source: 'unconfigured',
  tokenConfigured: false,
}

export const HostBootstrap = ({ children }: React.PropsWithChildren) => {
  const connection = React.useMemo<RegistryConnection>(registryConnection, [])
  const [state, setState] = React.useState<BootstrapState>({
    kind: 'checking',
  })
  const [checkAttempt, setCheckAttempt] = React.useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: the attempt counter intentionally retries the host request.
  React.useEffect(() => {
    let active = true
    void connection
      .status()
      .then((configuration) => {
        if (!active) return
        if (configuration.configured) {
          setState({ kind: 'ready' })
          return
        }
        setState({ configuration, kind: 'setup' })
      })
      .catch((error: unknown) => {
        if (!active) return
        if (
          error instanceof RegistryConnectionError &&
          error.code === 'settings_corrupt'
        ) {
          setState({
            configuration: repairConfiguration,
            kind: 'setup',
            warning: error.message,
          })
          return
        }
        setState({
          error:
            error instanceof Error
              ? error.message
              : 'The Registry connection could not be loaded.',
          kind: 'check-failed',
        })
      })
    return () => {
      active = false
    }
  }, [connection, checkAttempt])

  if (state.kind === 'ready') return children

  return (
    <main className="grid min-h-screen place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-4" />
            Connect the Registry
          </CardTitle>
          <CardDescription>
            Enter the deployed Registry API address and its bearer token.
            {connection.kind === 'desktop'
              ? ' The token is saved with operating-system credential encryption.'
              : ' The token is saved only in this browser.'}
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
                <AlertTitle>Could not load Registry settings</AlertTitle>
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
            <div className="grid gap-4">
              {state.warning === undefined ? null : (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertTitle>Replace invalid Registry settings</AlertTitle>
                  <AlertDescription>{state.warning}</AlertDescription>
                </Alert>
              )}
              <RegistryConnectionForm
                key={`${state.configuration.source}:${state.configuration.origin ?? ''}`}
                connection={connection}
                configuration={state.configuration}
                onConfigured={() => setState({ kind: 'ready' })}
                submitLabel="Test, save, and open Registry"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
