import { useLingui } from '@lingui/react'
import { LockKeyhole } from 'lucide-react'
import { cvMessages } from '@/i18n/messages'
import { useCvSession } from '@/lib/cv-document/hooks'
import { fullAccessEmail, fullAccessMailto } from '@/lib/private-access'

export const PublicVersionNotice = () => {
  const { route, status } = useCvSession()
  const { i18n } = useLingui()

  if (route && (status === 'loading' || route.token)) {
    return null
  }

  return (
    <aside className="cv-redacted-hatch -mx-5 max-w-none px-5 py-3 text-sm/6 text-muted-foreground sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10">
      <p className="inline-flex items-center gap-1.5 font-mono text-xs/5 uppercase text-primary">
        <LockKeyhole
          aria-hidden="true"
          className="size-3.5 shrink-0"
          strokeWidth={1.7}
        />
        {i18n._(cvMessages.redaction.noticeTitle)}
      </p>
      <div className="mt-1.5 grid gap-1">
        <p>{i18n._(cvMessages.redaction.noticeBody)}</p>
        <p>{i18n._(cvMessages.redaction.noticeDetail)}</p>
      </div>
      <p className="mt-4 font-mono text-xs/5 text-muted-foreground">
        {i18n._(cvMessages.redaction.noticeCtaPrefix)}{' '}
        <a
          className="text-primary underline-offset-4 hover:text-foreground hover:underline"
          href={fullAccessMailto}
        >
          {fullAccessEmail}
        </a>
        .
      </p>
    </aside>
  )
}
