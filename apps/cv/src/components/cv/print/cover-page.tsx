import { cn } from '@cv/ui/utils'
import { useLingui } from '@lingui/react'
import type { ComponentPropsWithoutRef } from 'react'
import { PrintExperienceEntry } from '@/components/cv/print/entries'
import { PrintPage, PrintSectionTitle } from '@/components/cv/print/primitives'
import { PrintQr } from '@/components/cv/print/qr'
import { stackText } from '@/components/cv/print/utils'
import {
  PrintProfileBlockList,
  PrintProfileSection,
  PrintSidebarTitle,
} from '@/components/cv/profile-blocks'
import {
  RedactedInlineText,
  redactedTextFallback,
} from '@/components/private-cv/redactions'
import { cvSectionByType, type RedactableText } from '@/cv-content/model'
import { cvMessages } from '@/i18n/messages'
import { useCvContent } from '@/lib/cv-document/hooks'

type PrintCoverFactProps = {
  label: string
  value: RedactableText
}

const PrintCoverHeader = ({
  className,
  ...props
}: ComponentPropsWithoutRef<'header'>) => (
  <header
    className={cn(
      'grid grid-cols-[minmax(0,1fr)_40mm] gap-[5mm] border-b-[0.25mm] border-slate-200 pb-[3mm]',
      className
    )}
    {...props}
  />
)

const PrintCoverFact = ({ label, value }: PrintCoverFactProps) => (
  <div className="contents">
    <dt className="m-0 border-b-[0.25mm] border-slate-200 py-[1.4mm] font-mono text-[7pt]/[1.25] text-slate-500 uppercase">
      {label}
    </dt>
    <dd className="m-0 border-b-[0.25mm] border-slate-200 py-[1.4mm] font-mono text-[7pt]/[1.25] font-bold text-slate-950">
      <RedactedInlineText value={value} />
    </dd>
  </div>
)

export const PrintCoverPage = () => {
  const content = useCvContent()
  const { i18n } = useLingui()
  const profile = cvSectionByType(content, 'profile')
  const experience = cvSectionByType(content, 'experience')
  const skills = cvSectionByType(content, 'skills')

  return (
    <PrintPage breakAfter="page">
      <PrintCoverHeader>
        <div>
          <p className="m-0 font-mono text-[7pt]/[1.2] text-blue-600">
            {'// CV'} · {i18n._(cvMessages.labels.lastUpdated)}:{' '}
            {content.identity.lastUpdated}
          </p>
          <h1 className="m-0 mt-[1.5mm] mb-[2mm] font-mono text-[30pt]/[0.9] font-extrabold tracking-normal text-blue-600">
            {content.identity.headline}
          </h1>
          <dl className="m-0 grid max-w-[128mm] grid-cols-[22mm_minmax(0,1fr)] border-t-[0.25mm] border-slate-200">
            <PrintCoverFact
              label={i18n._(cvMessages.labels.name)}
              value={content.identity.name}
            />
            <PrintCoverFact
              label={i18n._(cvMessages.labels.focus)}
              value={content.identity.role}
            />
          </dl>
          <p className="m-0 mt-[2.3mm] max-w-[132mm] text-[8.4pt]/[1.38] text-slate-700">
            {content.identity.summary}
          </p>
        </div>
        <PrintQr />
      </PrintCoverHeader>

      <div className="mt-[3.5mm] grid grid-cols-[35mm_minmax(0,1fr)] gap-[5mm]">
        <aside className="border-r-[0.25mm] border-slate-200 pr-[4mm]">
          {profile.items.map((section) => (
            <PrintProfileSection
              className="[&:not(:has([data-profile-row-title]))]:hidden"
              key={section.id}
            >
              <PrintProfileBlockList blocks={section.blocks} />
            </PrintProfileSection>
          ))}
          <PrintProfileSection>
            <PrintSidebarTitle>
              {i18n._(cvMessages.labels.selectedStack)}
            </PrintSidebarTitle>
            <p className="m-0 font-mono text-[6.6pt]/[1.3] text-slate-700">
              {stackText(skills.printStack)}
            </p>
          </PrintProfileSection>
        </aside>

        <main>
          <PrintSectionTitle
            index={experience.index}
            title={experience.label}
          />
          <div className="grid gap-[6mm]">
            {experience.items.map((item) => (
              <PrintExperienceEntry
                item={item}
                key={`${redactedTextFallback(item.company)}-${item.period}`}
              />
            ))}
          </div>
        </main>
      </div>
    </PrintPage>
  )
}
