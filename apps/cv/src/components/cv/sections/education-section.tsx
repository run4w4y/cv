import { CvActionLink, cvActionLinkKey } from '@/components/cv/action-link'
import { SectionShell } from '@/components/cv/section-shell'
import type { CvContent } from '@/cv-content/model'

type EducationSectionProps = {
  section: Extract<CvContent['sections'][number], { type: 'education' }>
}

export const EducationSection = ({ section }: EducationSectionProps) => {
  return (
    <SectionShell
      description={section.description ?? ''}
      id={section.id}
      index={section.index}
      title={section.label}
    >
      {section.items.map((item) => (
        <article
          className="print-break-inside-avoid grid gap-5 border-b border-border p-6 last:border-b-0 md:p-8 lg:grid-cols-[9rem_1fr_13rem]"
          key={`${item.degree}-${item.institution}`}
        >
          <div className="font-mono text-xs/5 text-muted-foreground">
            <div>{item.period}</div>
            <div className="mt-1 text-slate-500 dark:text-slate-400">
              {item.location}
            </div>
          </div>
          <div>
            <h2 className="font-mono text-sm/6 font-semibold text-foreground">
              {item.degree}
            </h2>
            <p className="mt-2 text-sm/6 text-slate-700 dark:text-slate-300">
              {item.institution}
            </p>
            {item.thesis ? (
              <div className="mt-5 border-t border-border pt-4">
                <h3 className="font-mono text-xs/5 text-blue-600 dark:text-blue-400">
                  {item.thesis.title}
                </h3>
                <p className="mt-2 text-xs/5 text-slate-700 dark:text-slate-300">
                  {item.thesis.summary}
                </p>
                <div className="mt-3 flex flex-wrap gap-3 font-mono text-xs/5 text-blue-600 dark:text-blue-400">
                  {item.thesis.links.map((link) => (
                    <CvActionLink
                      href={link.href}
                      icon={link.icon}
                      key={cvActionLinkKey(link)}
                      label={link.label}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <p className="font-mono text-xs/5 text-muted-foreground">
            {item.details}
          </p>
        </article>
      ))}
    </SectionShell>
  )
}
