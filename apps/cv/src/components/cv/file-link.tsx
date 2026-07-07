import { resolveContentFile } from '@cv/private-content-session'
import { cn } from '@cv/ui/utils'
import { LockKeyhole } from 'lucide-react'
import {
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  useState,
} from 'react'
import { PrivateAccessHoverCard } from '@/components/private-cv/access-hover-card'
import { useCvSession, useOpenCvFile } from '@/lib/cv-document/hooks'

type CvFileLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode
  href: string
}

export const CvFileLink = ({
  children,
  className,
  href,
  onClick,
  role,
  tabIndex,
  ...props
}: CvFileLinkProps) => {
  const session = useCvSession()
  const openFile = useOpenCvFile()
  const resolution = resolveContentFile(session, href)
  const [opening, setOpening] = useState(false)
  const isPrivate = resolution.kind === 'private'
  const isPrivateReady = isPrivate && session.status === 'unlocked'
  const isPrivateLocked = isPrivate && !isPrivateReady
  const isUnresolved =
    resolution.kind === 'missing' || resolution.kind === 'unknown'
  const isDisabled = isUnresolved || isPrivateLocked
  const resolvedHref = isPrivateLocked ? undefined : resolution.href
  const resolvedRole = isPrivateLocked ? (role ?? 'link') : role
  const resolvedTabIndex = isPrivateLocked ? (tabIndex ?? 0) : tabIndex
  const fileState = isPrivate
    ? isPrivateReady
      ? opening
        ? 'opening'
        : 'private-ready'
      : 'private-locked'
    : resolution.kind

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)

    if (event.defaultPrevented) {
      return
    }

    if (isUnresolved) {
      event.preventDefault()
      return
    }

    if (!isPrivate) {
      return
    }

    event.preventDefault()

    if (!isPrivateReady || opening) {
      return
    }

    setOpening(true)
    void openFile(href)
      .catch((cause: unknown) => {
        console.error('Could not open full-version CV file', cause)
      })
      .finally(() => setOpening(false))
  }

  const link = (
    <a
      aria-disabled={isDisabled ? 'true' : undefined}
      aria-busy={opening ? 'true' : undefined}
      className={cn(
        'group/cv-file',
        className,
        isDisabled &&
          'cursor-not-allowed text-muted-foreground opacity-80 hover:text-muted-foreground',
        isPrivateLocked &&
          'decoration-dotted underline-offset-4 data-[cv-file-state=private-locked]:[text-decoration-style:dotted]'
      )}
      data-cv-file-state={fileState}
      data-private-file-unavailable={isPrivateLocked ? 'true' : undefined}
      href={resolvedHref}
      onClick={handleClick}
      role={resolvedRole}
      tabIndex={resolvedTabIndex}
      {...props}
    >
      {children}
      {isPrivateLocked ? (
        <LockKeyhole
          aria-hidden="true"
          className="size-3.5 shrink-0"
          data-cv-file-lock-icon
          data-icon="inline-end"
          strokeWidth={1.7}
        />
      ) : null}
    </a>
  )

  return isPrivateLocked ? (
    <PrivateAccessHoverCard>{link}</PrivateAccessHoverCard>
  ) : (
    link
  )
}
