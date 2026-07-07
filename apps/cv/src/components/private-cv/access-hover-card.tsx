import { cn } from '@cv/ui/utils'
import { useLingui } from '@lingui/react'
import { LockKeyhole } from 'lucide-react'
import type { ReactElement } from 'react'
import { cvMessages } from '@/i18n/messages'
import { fullAccessEmail, fullAccessMailto } from '@/lib/private-access'

type PrivateAccessHoverCardProps = {
  children: ReactElement
  className?: string
}

export const PrivateAccessHoverCard = ({
  children,
  className,
}: PrivateAccessHoverCardProps) => {
  const { i18n } = useLingui()

  return (
    <span className="group/private-access relative inline-flex max-w-full align-baseline">
      {children}
      <span
        className={cn(
          'screen-only pointer-events-none invisible fixed top-4 right-4 left-4 z-50 w-auto max-w-none opacity-0 transition-opacity duration-150 sm:absolute sm:top-auto sm:right-auto sm:bottom-full sm:left-1/2 sm:w-96 sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:pb-2',
          'group-hover/private-access:pointer-events-auto group-hover/private-access:visible group-hover/private-access:opacity-100 group-focus-within/private-access:pointer-events-auto group-focus-within/private-access:visible group-focus-within/private-access:opacity-100',
          className
        )}
        data-private-access-hover-card
        role="tooltip"
      >
        <span className="block border border-border bg-popover/80 p-4 font-sans font-normal not-italic text-popover-foreground shadow-[2px_2px_0_var(--border)] backdrop-blur-sm">
          <span
            className="flex items-center gap-2 font-mono text-xs/5 font-bold uppercase text-primary"
            data-private-access-hover-title
          >
            <LockKeyhole
              aria-hidden="true"
              className="size-3.5 shrink-0"
              strokeWidth={1.7}
            />
            {i18n._(cvMessages.redaction.hiddenTitle)}
          </span>
          <span
            className="mt-2 block text-sm/6 font-normal text-slate-700"
            data-private-access-hover-body
          >
            {i18n._(cvMessages.redaction.hiddenBody)}
          </span>
          <span
            className="mt-3 block whitespace-normal break-words border-t border-border pt-3 font-mono text-xs/5 text-muted-foreground"
            data-private-access-hover-cta
          >
            {i18n._(cvMessages.redaction.fullAccessPrefix)}{' '}
            <a
              className="pointer-events-auto break-words text-primary underline-offset-4 hover:text-foreground hover:underline"
              href={fullAccessMailto}
            >
              {fullAccessEmail}
            </a>
            .
          </span>
        </span>
      </span>
    </span>
  )
}
