import type { DesktopRegistryConfiguration } from '@cv/application-registry-desktop-contract'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
} from '@cv/internal-ui'
import { CircleAlert, LoaderCircle } from 'lucide-react'
import * as React from 'react'

import { desktopBridge } from './desktop'

export const RegistryConnectionForm = ({
  configuration,
  onCancel,
  onConfigured,
  submitLabel,
}: {
  readonly configuration: DesktopRegistryConfiguration
  readonly onCancel?: () => void
  readonly onConfigured: (configuration: DesktopRegistryConfiguration) => void
  readonly submitLabel: string
}) => {
  const originId = React.useId()
  const tokenId = React.useId()
  const [origin, setOrigin] = React.useState(configuration.origin ?? '')
  const [token, setToken] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)
  const tokenRequired = configuration.source === 'unconfigured'

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        const bridge = desktopBridge()
        if (bridge === null || saving) return

        setError(null)
        setSaving(true)
        const replacementToken = token.trim()
        void bridge.registry
          .configure({
            origin,
            ...(replacementToken.length > 0 ? { token: replacementToken } : {}),
          })
          .then((result) => {
            if (result.ok && result.value.configured) {
              setToken('')
              onConfigured(result.value)
              return
            }
            setError(
              result.ok
                ? 'The Registry configuration was not saved.'
                : result.error.message
            )
          })
          .catch((cause: unknown) => {
            setError(
              cause instanceof Error
                ? cause.message
                : 'The desktop host did not answer.'
            )
          })
          .finally(() => setSaving(false))
      }}
    >
      <div className="grid gap-2 text-sm">
        <label className="font-medium" htmlFor={originId}>
          Registry API origin
        </label>
        <Input
          aria-describedby={`${originId}-description`}
          autoComplete="url"
          disabled={saving}
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
          Use HTTPS, except for localhost development.
        </span>
      </div>
      <div className="grid gap-2 text-sm">
        <label className="font-medium" htmlFor={tokenId}>
          {tokenRequired ? 'Machine API token' : 'New machine API token'}
        </label>
        <Input
          aria-describedby={
            tokenRequired ? undefined : `${tokenId}-description`
          }
          autoComplete="new-password"
          disabled={saving}
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
            Leave blank to keep the currently encrypted token.
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
            disabled={saving}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
        )}
        <Button disabled={saving} type="submit">
          {saving ? (
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
