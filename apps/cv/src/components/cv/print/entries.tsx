import { cn } from '@cv/ui/utils'
import { RedactedInlineText } from '@/components/private-cv/redactions'
import type { CvContent, ExperienceItem, ProjectItem } from '@/cv-content/model'
import { PrintLink } from './primitives'
import { skillText, stackText } from './utils'

type PrintExperienceEntryProps = {
  item: ExperienceItem
}

type PrintProjectProps = {
  flushTop?: boolean
  project: ProjectItem
}

type PrintSkillsProps = {
  section: Extract<CvContent['sections'][number], { type: 'skills' }>
}

type PrintEducationProps = {
  section: Extract<CvContent['sections'][number], { type: 'education' }>
}

export const PrintExperienceEntry = ({ item }: PrintExperienceEntryProps) => (
  <article className="break-inside-avoid">
    <header className="block">
      <div>
        <p className="m-0 font-mono text-[6.5pt]/[1.25] text-slate-500">
          {item.period} · {item.location}
        </p>
        <h3 className="m-0 mt-[0.8mm] font-mono text-[8.4pt]/[1.25] text-slate-950">
          {item.title} · <RedactedInlineText value={item.company} />
        </h3>
        <p className="m-0 mt-[1.2mm] font-mono text-[6.5pt]/[1.25] text-blue-600">
          {stackText(item.stack)}
        </p>
      </div>
    </header>
    <p className="m-0 mt-[1.5mm] text-[7.5pt]/[1.34] text-slate-700">
      {item.summary}
    </p>
    {item.workstreams ? (
      <div className="mt-[1.6mm] grid grid-cols-2 gap-x-[3mm] gap-y-[1.6mm] border-t-[0.25mm] border-slate-200 pt-[1.6mm]">
        {item.workstreams.map((workstream) => (
          <div key={workstream.title}>
            <h4 className="m-0 font-mono text-[6.5pt]/[1.2] text-blue-600">
              {workstream.title}
            </h4>
            <p className="m-0 mt-[0.3mm] text-[6.7pt]/[1.24] text-slate-700">
              {workstream.summary}
            </p>
          </div>
        ))}
      </div>
    ) : (
      <ul className="m-0 mt-[1.5mm] grid list-none gap-[0.7mm] p-0 text-[7pt]/[1.28] text-slate-700">
        {item.highlights.map((highlight) => (
          <li key={highlight}>
            <span className="text-blue-600">- </span>
            {highlight}
          </li>
        ))}
      </ul>
    )}
  </article>
)

export const PrintProject = ({ flushTop, project }: PrintProjectProps) => (
  <article
    className={cn(
      'break-inside-avoid border-t-[0.25mm] border-slate-200 pt-[2.4mm]',
      flushTop && 'border-t-0 pt-0'
    )}
    data-print-project
  >
    <div className="grid grid-cols-[18mm_minmax(0,1fr)] items-start gap-[2.5mm]">
      {project.visibility ? (
        <p className="m-0 font-mono text-[6.4pt]/[1.2] text-blue-600">
          {project.visibility}
        </p>
      ) : null}
      <h3 className="m-0 font-mono text-[7.4pt]/[1.25] text-slate-950">
        {project.name}
      </h3>
    </div>
    <p className="m-0 mt-[1.4mm] text-[7pt]/[1.28] text-slate-700">
      {project.summary}
    </p>
    <footer className="m-0 mt-[1.3mm] grid gap-[0.7mm] font-mono text-[6.3pt]/[1.25] text-slate-500">
      <span>{stackText(project.stack)}</span>
      {project.links.length > 0 ? (
        <span className="flex flex-wrap gap-[2mm] text-blue-600">
          {project.links.map((link) => (
            <PrintLink href={link.href} key={link.label}>
              {link.label}
            </PrintLink>
          ))}
        </span>
      ) : null}
    </footer>
  </article>
)

export const PrintSkills = ({ section }: PrintSkillsProps) => (
  <div className="grid gap-[2.1mm]">
    {section.items.map((skill) => (
      <div
        className="break-inside-avoid border-t-[0.25mm] border-slate-200 pt-[1.9mm] first:border-t-0 first:pt-0"
        key={skill.group}
      >
        <h3 className="m-0 font-mono text-[7.1pt]/[1.2] text-slate-950">
          {skill.group}
        </h3>
        <p className="m-0 mt-[0.9mm] font-mono text-[6.3pt]/[1.28] text-slate-700">
          {skillText(skill)}
        </p>
      </div>
    ))}
  </div>
)

export const PrintEducation = ({ section }: PrintEducationProps) => (
  <div className="grid gap-[2.1mm]">
    {section.items.map((item) => (
      <article
        className="grid break-inside-avoid gap-[1.1mm] border-t-[0.25mm] border-slate-200 pt-[1.9mm] text-[6.8pt]/[1.28] text-slate-700 first:border-t-0 first:pt-0"
        key={item.degree}
      >
        <div>
          <p className="m-0 font-mono text-[6.3pt]/[1.25] text-slate-500">
            {item.period}
          </p>
          <h3 className="m-0 font-mono text-[7.1pt]/[1.2] text-slate-950">
            {item.degree}
          </h3>
          <span className="m-0 font-mono text-[6.3pt]/[1.25] text-slate-500">
            {item.institution} · {item.location}
          </span>
        </div>
        <p className="m-0">{item.details}</p>
        {item.thesis ? (
          <div>
            <h4 className="m-0 font-mono text-[6.7pt]/[1.25] text-blue-600">
              {item.thesis.title}
            </h4>
            <p className="m-0">{item.thesis.summary}</p>
            <span>
              {item.thesis.links.map((link) => (
                <PrintLink
                  className="mr-[2mm] font-mono text-[6.4pt] text-blue-600"
                  href={link.href}
                  key={link.label}
                >
                  {link.label}
                </PrintLink>
              ))}
            </span>
          </div>
        ) : null}
      </article>
    ))}
  </div>
)
