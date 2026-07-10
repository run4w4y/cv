import { cn } from '@cv/ui/utils'
import { useLingui } from '@lingui/react'
import { CircleHelp, LockKeyhole } from 'lucide-react'
import type { ReactElement } from 'react'
import { useId } from 'react'
import { cvMessages } from '@/i18n/messages'
import { fullAccessEmail, fullAccessMailto } from '@/lib/private-access'

type PrivateAccessHelpProps = {
  children: ReactElement
  className?: string
}

export const PrivateAccessHelp = ({
  children,
  className,
}: PrivateAccessHelpProps) => {
  const { i18n } = useLingui()
  const id = useId()
  const popoverId = `${id}-private-access`
  const titleId = `${popoverId}-title`
  const bodyId = `${popoverId}-body`

  return (
    <span className="inline-flex max-w-full items-baseline align-baseline">
      {children}
      <button
        aria-controls={popoverId}
        aria-haspopup="dialog"
        aria-label={i18n._(cvMessages.redaction.hiddenTitle)}
        className="screen-only ml-1 inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full border border-primary/50 text-primary hover:border-primary hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        data-private-access-help-trigger
        popoverTarget={popoverId}
        popoverTargetAction="toggle"
        type="button"
      >
        <CircleHelp aria-hidden="true" className="size-3" strokeWidth={1.8} />
      </button>
      <span
        aria-describedby={bodyId}
        aria-labelledby={titleId}
        className={cn(
          'screen-only fixed top-4 left-1/2 z-50 m-0 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 border border-border bg-popover p-4 font-sans font-normal text-popover-foreground not-italic shadow-[2px_2px_0_var(--border)] backdrop:bg-transparent sm:top-auto sm:bottom-4',
          className
        )}
        data-private-access-hover-card
        id={popoverId}
        popover="auto"
        role="dialog"
      >
        <span
          className="flex items-center gap-2 font-mono text-xs/5 font-bold uppercase text-primary"
          data-private-access-hover-title
          id={titleId}
        >
          <LockKeyhole
            aria-hidden="true"
            className="size-3.5 shrink-0"
            strokeWidth={1.7}
          />
          {i18n._(cvMessages.redaction.hiddenTitle)}
        </span>
        <span
          className="mt-2 block text-sm/6 font-normal text-popover-foreground"
          data-private-access-hover-body
          id={bodyId}
        >
          {i18n._(cvMessages.redaction.hiddenBody)}
        </span>
        <span
          className="mt-3 block border-t border-border pt-3 font-mono text-xs/5 whitespace-normal text-muted-foreground"
          data-private-access-hover-cta
        >
          {i18n._(cvMessages.redaction.fullAccessPrefix)}{' '}
          <a
            className="break-words text-primary underline-offset-4 hover:text-foreground hover:underline"
            href={fullAccessMailto}
          >
            {fullAccessEmail}
          </a>
          .
        </span>
      </span>
    </span>
  )
}
