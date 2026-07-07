import { cn } from '@cv/ui/utils'
import { useLingui } from '@lingui/react'
import { PrintLink } from '@/components/cv/print/primitives'
import { cvMessages } from '@/i18n/messages'
import { useCvSession } from '@/lib/cv-document/hooks'
import type { CvSession } from '@/lib/private-content-session/session'

const emptyQrSvg =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"%3E%3Crect width="256" height="256" fill="white"/%3E%3C/svg%3E'

const printUrlFromSession = ({ page, route }: CvSession) => {
  const href = page.webUrl

  if (!href) {
    return ''
  }

  const url = new URL(href)
  url.hash = ''

  if (route?.token) {
    url.searchParams.set('p', route.token)
  } else {
    url.searchParams.delete('p')
  }

  return url.toString()
}

export const PrintQr = () => {
  const session = useCvSession()
  const { route, status } = session
  const { i18n } = useLingui()
  const printUrl = printUrlFromSession(session)
  const privateQrUnlocked = Boolean(route?.token && status === 'unlocked')

  return (
    <PrintLink
      className="grid justify-items-center text-center font-mono text-[6.3pt]/[1.15] text-slate-500"
      href={printUrl}
      data-print-qr-link
    >
      <img
        alt=""
        className="size-[34mm] border-[0.25mm] border-slate-200 bg-white p-[1mm] [image-rendering:pixelated]"
        data-print-qr-image
        data-print-qr-url={printUrl}
        data-private-qr-image={route ? true : undefined}
        data-private-qr-unlocked={privateQrUnlocked ? true : undefined}
        src={emptyQrSvg}
      />
      <span className="mt-[1mm] font-bold text-blue-600 uppercase">
        {i18n._(cvMessages.labels.fullWebCv)}
      </span>
      <small
        className={cn(
          'mt-[0.8mm] max-w-[38mm] text-[5.8pt]/[1.18] text-slate-500',
          '[text-wrap:balance]'
        )}
        data-print-qr-instructions
      >
        {i18n._(cvMessages.labels.qrInstructions)}
      </small>
    </PrintLink>
  )
}
