import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
} from '@cv/internal-ui'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import * as React from 'react'

import type {
  RegistryConnection,
  RegistryConnectionConfiguration,
} from './registry-connection'

export const RegistryConnectionForm = ({
  connection,
  configuration,
  onCancel,
  onConfigured,
  submitLabel,
}: {
  readonly configuration: RegistryConnectionConfiguration
  readonly connection: RegistryConnection
  readonly onCancel?: () => void
  readonly onConfigured: (
    configuration: RegistryConnectionConfiguration
  ) => void
  readonly submitLabel: string
}) => {
  const originId = React.useId()
  const tokenId = React.useId()
  const [origin, setOrigin] = React.useState(configuration.origin ?? '')
  const [token, setToken] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [operation, setOperation] = React.useState<'reset' | 'save' | null>(
    null
  )
  const busy = operation !== null
  const resetConnection = connection.reset
  const tokenRequired = !configuration.tokenConfigured

  const run = (
    kind: 'reset' | 'save',
    action: () => Promise<RegistryConnectionConfiguration>
  ) => {
    if (busy) return
    setError(null)
    setOperation(kind)
    void action()
      .then((nextConfiguration) => {
        setToken('')
        onConfigured(nextConfiguration)
      })
      .catch((cause: unknown) => {
        setError(
          cause instanceof Error
            ? cause.message
            : 'The Registry connection could not be updated.'
        )
      })
      .finally(() => setOperation(null))
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        const replacementToken = token.trim()
        run('save', () =>
          connection.configure({
            origin,
            ...(replacementToken.length > 0 ? { token: replacementToken } : {}),
          })
        )
      }}
    >
      <div className="grid gap-2 text-sm">
        <label className="font-medium" htmlFor={originId}>
          Registry API base URL
        </label>
        <Input
          aria-describedby={`${originId}-description`}
          autoComplete="url"
          disabled={busy}
          id={originId}
          placeholder="https://registry.example.com"
          required
          type="url"
          value={origin}
          onChange={(event) => setOrigin(event.currentTarget.value)}
        />
        <span
          className="text-xs text-muted-foreground"
          id={`${originId}-description`}
        >
          Requests use this Registry&apos;s authenticated API.
        </span>
      </div>
      <div className="grid gap-2 text-sm">
        <label className="font-medium" htmlFor={tokenId}>
          {tokenRequired
            ? 'Registry bearer token'
            : 'New Registry bearer token'}
        </label>
        <Input
          aria-describedby={
            tokenRequired ? undefined : `${tokenId}-description`
          }
          autoComplete="new-password"
          disabled={busy}
          id={tokenId}
          required={tokenRequired}
          type="password"
          value={token}
          onChange={(event) => setToken(event.currentTarget.value)}
        />
        {tokenRequired ? null : (
          <span
            className="text-xs text-muted-foreground"
            id={`${tokenId}-description`}
          >
            Leave blank to keep the current token.
          </span>
        )}
      </div>
      {error === null ? null : (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Could not update the connection</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div
        className={
          onCancel === undefined
            ? 'grid'
            : 'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'
        }
      >
        {onCancel === undefined ? null : (
          <Button
            disabled={busy}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        )}
        {configuration.resettable && resetConnection !== undefined ? (
          <Button
            disabled={busy}
            onClick={() => run('reset', resetConnection)}
            type="button"
            variant="outline"
          >
            {operation === 'reset' ? (
              <>
                <LoaderCircle className="animate-spin" />
                Forgetting saved connection…
              </>
            ) : (
              'Forget saved connection'
            )}
          </Button>
        ) : null}
        <Button disabled={busy} type="submit">
          {operation === 'save' ? (
            <>
              <LoaderCircle className="animate-spin" />
              Testing and saving…
            </>
          ) : (
            submitLabel
          )}
        </Button>
      </div>
    </form>
  )
}
