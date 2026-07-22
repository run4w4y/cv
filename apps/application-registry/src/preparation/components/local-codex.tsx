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
import { CircleAlert, Laptop, LoaderCircle, Sparkles } from 'lucide-react'
import * as React from 'react'

import { desktopBridge } from '@/host/desktop'

export type LocalCodexProps = {
  readonly variant?: 'card' | 'compact'
}

type CodexState =
  | { readonly kind: 'checking' }
  | { readonly kind: 'ready'; readonly message: string }
  | { readonly error: string; readonly kind: 'unavailable' }

export const LocalCodex = ({ variant = 'card' }: LocalCodexProps) => {
  const bridge = desktopBridge()
  const [attempt, setAttempt] = React.useState(0)
  const [state, setState] = React.useState<CodexState>({ kind: 'checking' })

  // biome-ignore lint/correctness/useExhaustiveDependencies: the attempt counter intentionally retries the host request.
  React.useEffect(() => {
    if (bridge === null) return
    let active = true
    void bridge.codex
      .status()
      .then((result) => {
        if (!active) return
        if (!result.ok) {
          setState({ error: result.error.message, kind: 'unavailable' })
        } else if (!result.value.available) {
          setState({ error: result.value.message, kind: 'unavailable' })
        } else {
          setState({ kind: 'ready', message: result.value.message })
        }
      })
      .catch((error: unknown) => {
        if (!active) return
        setState({
          error:
            error instanceof Error
              ? error.message
              : 'The desktop host did not answer.',
          kind: 'unavailable',
        })
      })
    return () => {
      active = false
    }
  }, [attempt, bridge])

  if (bridge === null) {
    return (
      <Alert>
        <Sparkles />
        <AlertTitle>Desktop workflow</AlertTitle>
        <AlertDescription>
          {variant === 'compact'
            ? 'Open the local desktop app to run AI preparation.'
            : 'AI preparation is intentionally disabled in the Cloudflare web app. Open this registry in the local desktop app to generate or revise content; manual editing and publication remain available here.'}
        </AlertDescription>
      </Alert>
    )
  }

  const retry = () => {
    setState({ kind: 'checking' })
    setAttempt((value) => value + 1)
  }
  const content =
    state.kind === 'checking' ? (
      <span className="flex items-center gap-2">
        <LoaderCircle className="size-4 animate-spin" />
        Checking the packaged Codex runtime…
      </span>
    ) : state.kind === 'unavailable' ? (
      <span className="grid gap-3">
        <span>{state.error}</span>
        <Button className="w-fit" onClick={retry} size="sm" type="button">
          Retry Codex check
        </Button>
      </span>
    ) : (
      state.message
    )

  if (variant === 'compact') {
    return (
      <Alert variant={state.kind === 'unavailable' ? 'destructive' : 'default'}>
        {state.kind === 'unavailable' ? <CircleAlert /> : <Laptop />}
        <AlertTitle>
          {state.kind === 'ready'
            ? 'Local Codex ready'
            : state.kind === 'checking'
              ? 'Checking local Codex'
              : 'Local Codex unavailable'}
        </AlertTitle>
        <AlertDescription>{content}</AlertDescription>
      </Alert>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Laptop className="size-4" />
          Local Codex
        </CardTitle>
        <CardDescription>
          Uses the Codex runtime packaged with this app and the ChatGPT sign-in
          already stored for this Windows account.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        {content}
      </CardContent>
    </Card>
  )
}
