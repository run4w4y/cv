import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@cv/internal-ui'
import { useAtomSet } from '@effect/atom-react'
import { useLoginWithChatGPT } from '@opencoredev/loginwithchatgpt-react'
import { CircleAlert, Copy, ExternalLink, LogOut, Sparkles } from 'lucide-react'
import * as React from 'react'

import { chatGptAuthenticatedAtom } from '../auth/atoms'

export const ChatGptAccess = () => {
  const auth = useLoginWithChatGPT({ basePath: '/api/chatgpt' })
  const setAuthenticated = useAtomSet(chatGptAuthenticatedAtom)
  const [showConsent, setShowConsent] = React.useState(false)

  React.useEffect(() => {
    setAuthenticated(auth.isAuthenticated)
  }, [auth.isAuthenticated, setAuthenticated])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4" />
          ChatGPT subscription
        </CardTitle>
        <CardDescription>
          Generation uses the ChatGPT plan you connect here. No API key is
          requested by this app.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {auth.status === 'loading' ? (
          <p className="text-sm text-muted-foreground">Checking session…</p>
        ) : auth.isAuthenticated ? (
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">Connected</Badge>
            <span className="text-sm">
              {auth.user?.name ?? auth.user?.email ?? 'ChatGPT account'}
              {auth.user?.plan ? ` · ${auth.user.plan}` : ''}
            </span>
            <Button
              className="ml-auto"
              size="sm"
              variant="outline"
              onClick={() => void auth.logout()}
            >
              <LogOut />
              Disconnect
            </Button>
          </div>
        ) : auth.isPending ? (
          <div className="grid gap-3 rounded-md border border-border p-4">
            <p className="text-sm font-medium">
              Enter this code in the ChatGPT verification tab
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-sm bg-muted px-3 py-2 text-lg font-semibold tracking-widest">
                {auth.userCode}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void auth.copyCode()}
              >
                <Copy />
                {auth.copied ? 'Copied' : 'Copy'}
              </Button>
              <Button size="sm" variant="outline" onClick={auth.reopen}>
                <ExternalLink />
                Reopen
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This page will update automatically after authorization.
            </p>
          </div>
        ) : showConsent ? (
          <div className="grid gap-3 rounded-md border border-border p-4">
            <p className="text-sm font-semibold">
              Allow Registry to send generation requests on your ChatGPT plan?
            </p>
            <ul className="grid list-disc gap-2 pl-5 text-sm text-muted-foreground">
              <li>Prompts pass through your own Registry Worker.</li>
              <li>Requests count against the connected plan’s usage limits.</li>
              <li>Disconnecting removes the stored Registry session.</li>
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={auth.isConnecting}
                onClick={() => {
                  setShowConsent(false)
                  void auth.login()
                }}
              >
                {auth.isConnecting ? 'Connecting…' : 'I understand, connect'}
              </Button>
              <Button variant="ghost" onClick={() => setShowConsent(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button className="w-fit" onClick={() => setShowConsent(true)}>
            <Sparkles />
            Connect ChatGPT
          </Button>
        )}
        {auth.error ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>ChatGPT connection failed</AlertTitle>
            <AlertDescription>{auth.error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}
