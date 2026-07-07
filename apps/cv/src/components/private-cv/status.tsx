import { useLingui } from '@lingui/react'
import { KeyRound, LockKeyhole } from 'lucide-react'
import { cvMessages } from '@/i18n/messages'
import { useCvSession } from '@/lib/cv-document/hooks'

export const PrivateCvStatus = () => {
  const { route, status } = useCvSession()
  const { i18n } = useLingui()
  const message = status === 'public' ? '' : i18n._(cvMessages.status[status])

  if (!route || !message) {
    return null
  }

  return (
    <div className="screen-only border-b border-border bg-card/65">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-5 py-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-2 font-mono text-xs/5 text-muted-foreground">
          {status === 'unlocked' ? (
            <KeyRound
              aria-hidden="true"
              className="size-3.5 shrink-0 text-blue-600 dark:text-blue-400"
              strokeWidth={1.8}
            />
          ) : (
            <LockKeyhole
              aria-hidden="true"
              className="size-3.5 shrink-0"
              strokeWidth={1.8}
            />
          )}
          <span>{message}</span>
        </div>
      </div>
    </div>
  )
}
