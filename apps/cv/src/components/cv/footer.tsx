import {
  isRedactedText,
  RedactedInlineText,
} from '@/components/private-cv/redactions'
import { useCvContent } from '@/lib/cv-document/hooks'
import { TechIcon } from './tech-icon'

export const Footer = () => {
  const content = useCvContent()
  const sourceCode = content.document.links.sourceCode
  const linkContent = (
    <>
      <TechIcon iconSlot="inline-start" name="GitHub" />
      {sourceCode.label}: <RedactedInlineText value={sourceCode.value} />
    </>
  )
  const className =
    'inline-flex items-center gap-2 text-slate-700 dark:text-slate-300'

  return (
    <footer className="mx-auto flex max-w-7xl flex-col gap-3 border-x border-t border-border px-6 py-6 font-mono text-xs/5 text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <span>{content.document.footer.copyright}</span>
      <span>{content.document.footer.stack}</span>
      {isRedactedText(sourceCode.value) || !sourceCode.href ? (
        <span className={className}>{linkContent}</span>
      ) : (
        <a
          className={`${className} hover:text-blue-600 dark:hover:text-blue-400`}
          href={sourceCode.href}
          rel="noreferrer"
          target="_blank"
        >
          {linkContent}
        </a>
      )}
    </footer>
  )
}
