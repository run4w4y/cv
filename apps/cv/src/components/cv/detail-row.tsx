import type { ReactNode } from 'react'
import { RedactedInlineText } from '@/components/private-cv/redactions'
import type { RedactableText } from '@/cv-content/model'

type DetailRowProps = {
  children?: ReactNode
  href?: string
  label: string
  note?: string
  value?: RedactableText
}

export const DetailRow = ({
  children,
  href,
  label,
  note,
  value,
}: DetailRowProps) => {
  const valueContent =
    value === undefined ? children : <RedactedInlineText value={value} />
  const valueClassName =
    'font-mono text-xs/5 text-foreground [&>p]:m-0 [&>p+p]:mt-2'

  return (
    <div className="grid gap-4 border-b border-border p-6 last:border-b-0 md:grid-cols-[10rem_1fr_1fr] md:p-6">
      <h3 className="font-mono text-xs/5 text-muted-foreground">{label}</h3>
      {href ? (
        <a
          className={`${valueClassName} hover:text-blue-600 dark:hover:text-blue-400`}
          href={href}
          rel={href.startsWith('http') ? 'noreferrer' : undefined}
          target={href.startsWith('http') ? '_blank' : undefined}
        >
          {valueContent}
        </a>
      ) : (
        <div className={valueClassName}>{valueContent}</div>
      )}
      {note ? (
        <p className="text-xs/5 text-muted-foreground">{note}</p>
      ) : (
        <div />
      )}
    </div>
  )
}
