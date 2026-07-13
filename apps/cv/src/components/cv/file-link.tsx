import { resolveContentFile } from '@cv/private-content-session'
import { cn } from '@cv/ui/utils'
import { LockKeyhole } from 'lucide-react'
import {
  type AnchorHTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useState,
} from 'react'
import { PrivateAccessHelp } from '@/components/private-cv/access-hover-card'
import { contentFileLinkPresentation } from '@/lib/cv-document/file-link-resolution'
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
  onKeyDown,
  role,
  tabIndex,
  ...props
}: CvFileLinkProps) => {
  const session = useCvSession()
  const openFile = useOpenCvFile()
  const resolution = resolveContentFile(session, href)
  const [opening, setOpening] = useState(false)
  const presentation = contentFileLinkPresentation(
    resolution,
    session.status,
    opening
  )
  const isPrivateAction = presentation.mode === 'private-action'
  const isPrivateLocked = presentation.mode === 'private-locked'
  const isUnavailable = presentation.mode === 'unavailable'
  const isDisabled = isPrivateLocked || isUnavailable

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)

    if (event.defaultPrevented) {
      return
    }

    if (!isPrivateAction) {
      return
    }

    event.preventDefault()

    if (opening) {
      return
    }

    setOpening(true)
    void openFile(href)
      .catch((cause: unknown) => {
        console.error('Could not open full-version CV file', cause)
      })
      .finally(() => setOpening(false))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLAnchorElement>) => {
    onKeyDown?.(event)

    if (
      !event.defaultPrevented &&
      isPrivateAction &&
      (event.key === 'Enter' || event.key === ' ')
    ) {
      event.preventDefault()
      event.currentTarget.click()
    }
  }

  const interactiveLink = (
    <a
      aria-busy={opening ? 'true' : undefined}
      className={cn('group/cv-file cursor-pointer', className)}
      data-cv-file-state={presentation.fileState}
      href={presentation.href}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role={isPrivateAction ? 'button' : role}
      tabIndex={isPrivateAction ? (tabIndex ?? 0) : tabIndex}
      {...props}
    >
      {children}
    </a>
  )

  if (!isDisabled) {
    return interactiveLink
  }

  const disabledContent = (
    <span
      aria-disabled="true"
      className={cn(
        'group/cv-file cursor-not-allowed text-muted-foreground opacity-80',
        isPrivateLocked && 'decoration-dotted underline-offset-4',
        className
      )}
      data-cv-file-state={presentation.fileState}
      data-private-file-unavailable={isPrivateLocked ? 'true' : undefined}
      tabIndex={isPrivateLocked ? (tabIndex ?? 0) : tabIndex}
    >
      {children}
      {isPrivateLocked && (
        <LockKeyhole
          aria-hidden="true"
          className="size-3.5 shrink-0"
          data-cv-file-lock-icon
          data-icon="inline-end"
          strokeWidth={1.7}
        />
      )}
    </span>
  )

  return isPrivateLocked ? (
    <PrivateAccessHelp>{disabledContent}</PrivateAccessHelp>
  ) : (
    disabledContent
  )
}
