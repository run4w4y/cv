import { cn } from '@cv/ui/utils'
import { useLingui } from '@lingui/react'
import { LockKeyhole } from 'lucide-react'
import type { ReactNode } from 'react'
import { PrivateAccessHelp } from '@/components/private-cv/access-hover-card'
import {
  contentVariableState,
  type VariableState,
} from '@/components/private-cv/variable-state'
import type {
  RedactableText,
  RedactedSectionDescriptor,
} from '@/cv-content/model'
import { cvMessages } from '@/i18n/messages'
import { useCvSession } from '@/lib/cv-document/hooks'
import { fullAccessEmail, fullAccessMailto } from '@/lib/private-access'

type VariableLookupRenderProps = {
  children: ReactNode
  label?: string
  state: VariableState
  variable: string
}

type RedactedSectionRenderProps = {
  children?: ReactNode
  fallback?: ReactNode
  state: VariableState
  title?: string
  variable: string
}

type VariableLookupProps = {
  children: ReactNode
  label?: string
  variable: string
}

type RedactedVariableSectionProps = {
  children?: ReactNode
  fallback?: ReactNode
  title?: string
  variable: string
}

type RedactedSectionProps = {
  children: ReactNode
  descriptor?: RedactedSectionDescriptor
  fallback?: string
  lockedBodyClassName?: string
  lockedClassName?: string
  lockedHeaderClassName?: string
  lockedBody?: ReactNode
  lockedTitle?: string
  title?: string
  variable?: string
}

type RedactedInlineTextProps = {
  className?: string
  value: RedactableText
}

type RenderVariableLookupProps = VariableLookupRenderProps & {
  fallback?: ReactNode
}

export const isRedactedText = (
  value: RedactableText
): value is Exclude<RedactableText, string> => typeof value !== 'string'

export const redactedTextFallback = (value: RedactableText) =>
  isRedactedText(value) ? value.fallback : value

export const renderVariableLookupText = ({
  children,
  fallback,
  label,
  state,
  variable,
}: RenderVariableLookupProps) => {
  const unlocked = state.status === 'resolved'
  const text = unlocked && typeof state.value === 'string' ? state.value : null
  const content = text ?? children ?? fallback

  if (unlocked) {
    return (
      <span
        data-content-variable={variable}
        data-content-variable-state="unlocked"
      >
        <span className="sr-only">{label}: </span>
        {content}
      </span>
    )
  }

  const element = (
    <span
      className="inline-flex max-w-full select-none items-baseline border-b border-dotted border-primary/50 font-mono text-[0.92em] font-normal text-muted-foreground underline-offset-4 transition-colors hover:border-primary hover:text-foreground"
      data-content-variable={variable}
      data-content-variable-state="locked"
    >
      <span className="sr-only">{label}: </span>
      <span aria-hidden="true" className="text-primary/70">
        [
      </span>
      <span className="mx-0.5 truncate">{content}</span>
      <span aria-hidden="true" className="text-primary/70">
        ]
      </span>
    </span>
  )

  return <PrivateAccessHelp>{element}</PrivateAccessHelp>
}

export const VariableLookupText = (props: VariableLookupProps) => {
  const session = useCvSession()
  const { i18n } = useLingui()
  const { variable } = props
  const state = contentVariableState(session, variable)

  return renderVariableLookupText({
    children: props.children,
    fallback: i18n._(cvMessages.redaction.inlineFallback),
    label: props.label,
    state,
    variable,
  })
}

export const RedactedInlineText = ({
  className,
  value,
}: RedactedInlineTextProps) =>
  isRedactedText(value) ? (
    <span className={className}>
      <VariableLookupText label={value.label} variable={value.variable}>
        {value.fallback}
      </VariableLookupText>
    </span>
  ) : (
    value
  )

export const renderRedactedSection = ({
  children,
  fallback,
  state,
  title,
  variable,
}: RedactedSectionRenderProps) => {
  const unlocked = state.status === 'resolved'

  if (!unlocked) {
    return (
      fallback ?? <PrivateRedactedBlock title={title} variable={variable} />
    )
  }

  return (
    <div
      data-content-variable={variable}
      data-content-variable-state="unlocked"
    >
      {children ??
        (Array.isArray(state.value) ? (
          state.value.map((line) => (
            <p className="m-0" key={line}>
              {line}
            </p>
          ))
        ) : (
          <p className="m-0">{state.value}</p>
        ))}
    </div>
  )
}

export const RedactedVariableSection = (
  props: RedactedVariableSectionProps
) => {
  const session = useCvSession()
  const { variable } = props
  const state = contentVariableState(session, variable)

  return renderRedactedSection({
    children: props.children,
    fallback: props.fallback,
    state,
    title: props.title,
    variable,
  })
}

export const RedactedSection = ({
  children,
  descriptor,
  fallback,
  lockedBodyClassName,
  lockedClassName,
  lockedHeaderClassName,
  lockedBody,
  lockedTitle,
  title,
  variable,
}: RedactedSectionProps) => {
  const sectionDescriptor =
    descriptor ??
    (variable && fallback
      ? ({
          fallback,
          kind: 'RedactedSection',
          title,
          variable,
        } satisfies RedactedSectionDescriptor)
      : undefined)

  if (!sectionDescriptor) {
    return <>{children}</>
  }

  const fallbackNode = (
    <PrivateRedactedBlock
      body={lockedBody ?? sectionDescriptor.fallback}
      bodyClassName={lockedBodyClassName}
      className={lockedClassName}
      headerClassName={lockedHeaderClassName}
      section
      title={lockedTitle ?? sectionDescriptor.title}
      variable={sectionDescriptor.variable}
    />
  )

  return (
    <RedactedVariableSection
      fallback={fallbackNode}
      title={sectionDescriptor.title}
      variable={sectionDescriptor.variable}
    >
      {children}
    </RedactedVariableSection>
  )
}

type PrivateRedactedBlockProps = {
  body?: ReactNode
  bodyClassName?: string
  className?: string
  headerClassName?: string
  section?: boolean
  title?: string
  variable: string
}

const PrivateRedactedBlock = ({
  body,
  bodyClassName,
  className,
  headerClassName,
  section,
  title,
  variable,
}: PrivateRedactedBlockProps) => {
  const { i18n } = useLingui()
  const bodyContent = body ?? i18n._(cvMessages.redaction.sectionBody)

  return (
    <div
      className={className}
      data-content-redacted-section={section ? variable : undefined}
      data-content-redacted-section-state={section ? 'locked' : undefined}
      data-content-variable={variable}
      data-content-variable-state="locked"
    >
      {title ? (
        <div
          className={cn(
            'border-b border-border px-6 py-5 md:px-8 print:border-0 print:p-0',
            headerClassName
          )}
        >
          <h2 className="font-mono text-sm/6 font-semibold uppercase text-blue-600 dark:text-blue-400 print:m-0 print:text-[7.2pt]/[1.25]">
            {title}
          </h2>
        </div>
      ) : null}
      <div
        className={cn(
          'cv-redacted-hatch border-b border-border p-6 last:border-b-0 md:px-8 print:block print:border-0 print:p-0',
          bodyClassName
        )}
      >
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-1.5 font-mono text-xs/5 uppercase text-primary print:mt-[1.5mm] print:text-[6.7pt]/[1.25]">
            <LockKeyhole
              aria-hidden="true"
              className="size-3.5 shrink-0 print:hidden"
              strokeWidth={1.7}
            />
            {i18n._(cvMessages.redaction.redactedLabel)}
          </p>
          <p className="mt-2 text-sm/6 text-slate-700 dark:text-slate-300 print:mt-[0.3mm] print:text-[6.7pt]/[1.25] print:font-bold">
            {bodyContent}
          </p>
          <p className="mt-3 font-mono text-xs/5 text-muted-foreground print:mt-[0.3mm] print:text-[6.6pt]/[1.3]">
            {i18n._(cvMessages.redaction.sectionAccess)}{' '}
            <a
              className="text-primary underline-offset-4 hover:text-foreground hover:underline print:text-slate-700 print:no-underline"
              href={fullAccessMailto}
            >
              {fullAccessEmail}
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
