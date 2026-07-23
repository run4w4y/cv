import type {
  CvAdditionalSectionV1,
  CvContactLinkV1,
  CvDocumentV1,
  CvEducationItemV1,
  CvExperienceItemV1,
  CvProjectItemV1,
} from '@cv/contracts/document'
import type { ReactNode } from 'react'

import { cvRenderContractVersion } from '../../version'
import { ColorSchemeControl } from '../color-scheme-control'
import type { CvRendererLabels } from '../labels'
import { cvRendererLabelsForLocale } from '../labels'
import {
  type CvWebPresentation,
  type CvWebSection,
  cvWebPresentation,
} from '../presentation'
import { WebPrintButton } from './print-button'
import { WebSectionNavigation } from './section-navigation'

type WebCvRendererProps = {
  readonly document: CvDocumentV1
  readonly publicUrl?: string
  readonly renderVersion?: string
}

const keyedTexts = (values: ReadonlyArray<string>) => {
  const occurrences = new Map<string, number>()
  return values.map((value) => {
    const occurrence = occurrences.get(value) ?? 0
    occurrences.set(value, occurrence + 1)
    return { key: `${value}\u0000${occurrence}`, value }
  })
}

const ExternalValue = ({ contact }: { readonly contact: CvContactLinkV1 }) =>
  contact.href ? (
    <a href={contact.href}>{contact.value}</a>
  ) : (
    <span>{contact.value}</span>
  )

const WebContacts = ({
  contacts,
  label,
}: {
  readonly contacts: CvDocumentV1['person']['contacts']
  readonly label: string
}) => (
  <address aria-label={label} className="cv-web-contacts">
    {contacts.map((contact, index) => (
      <div className="cv-web-contact" key={`${contact.kind}-${contact.value}`}>
        <span>{contact.label}</span>
        <ExternalValue contact={contact} />
        <span aria-hidden="true" className="cv-web-contact-index">
          {String(index + 1).padStart(2, '0')}
        </span>
      </div>
    ))}
  </address>
)

const WebSectionShell = ({
  children,
  section,
}: {
  readonly children: ReactNode
  readonly section: CvWebSection
}) => (
  <section
    aria-labelledby={`${section.id}-title`}
    className="cv-web-section"
    id={section.id}
  >
    <div className="cv-web-section-grid">
      <header className="cv-web-section-label">
        <span>{section.index}</span>
        <h2 id={`${section.id}-title`}>{section.label}</h2>
        <p>
          <span aria-hidden="true">{'/* '}</span>
          {section.description}
          <span aria-hidden="true">{' */'}</span>
        </p>
      </header>
      <div className="cv-web-section-content">{children}</div>
    </div>
  </section>
)

const WebHighlights = ({ items }: { readonly items: ReadonlyArray<string> }) =>
  items.length === 0 ? null : (
    <ul className="cv-web-highlights">
      {keyedTexts(items).map((item) => (
        <li key={item.key}>{item.value}</li>
      ))}
    </ul>
  )

const WebTechnologies = ({
  items,
  label,
}: {
  readonly items: ReadonlyArray<string>
  readonly label: string
}) =>
  items.length === 0 ? null : (
    <ul aria-label={label} className="cv-web-technologies">
      {keyedTexts(items).map((item) => (
        <li key={item.key}>
          <span aria-hidden="true">+</span> {item.value}
        </li>
      ))}
    </ul>
  )

const ExperienceRow = ({
  entry,
  labels,
}: {
  readonly entry: CvExperienceItemV1
  readonly labels: CvRendererLabels
}) => (
  <article className="cv-web-entry cv-web-experience-entry">
    <div className="cv-web-entry-meta">
      <p>{entry.period}</p>
      {entry.location ? <p>{entry.location}</p> : null}
    </div>
    <div className="cv-web-entry-main">
      <h3>
        {entry.role} <span aria-hidden="true">·</span>{' '}
        <span>{entry.company}</span>
      </h3>
      {entry.summary ? (
        <p className="cv-web-entry-summary">{entry.summary}</p>
      ) : null}
      <WebHighlights items={entry.highlights} />
    </div>
    <WebTechnologies items={entry.technologies} label={labels.technologies} />
  </article>
)

const ProjectLinks = ({
  links,
}: {
  readonly links: ReadonlyArray<CvContactLinkV1>
}) =>
  links.length === 0 ? null : (
    <ul className="cv-web-project-links">
      {links.map((link) => (
        <li key={`${link.kind}-${link.value}`}>
          {link.href ? (
            <a href={link.href}>
              {link.label} <span aria-hidden="true">↗</span>
            </a>
          ) : (
            link.value
          )}
        </li>
      ))}
    </ul>
  )

const ProjectRow = ({
  entry,
  labels,
}: {
  readonly entry: CvProjectItemV1
  readonly labels: CvRendererLabels
}) => (
  <article className="cv-web-entry cv-web-project-entry">
    <div className="cv-web-project-title">
      <p>{labels.selectedWork}</p>
      <h3>{entry.name}</h3>
    </div>
    <div className="cv-web-entry-main">
      <p className="cv-web-entry-summary">{entry.summary}</p>
      <WebHighlights items={entry.highlights} />
    </div>
    <div className="cv-web-entry-aside">
      <WebTechnologies items={entry.technologies} label={labels.technologies} />
      <ProjectLinks links={entry.links} />
    </div>
  </article>
)

const EducationRow = ({ entry }: { readonly entry: CvEducationItemV1 }) => (
  <article className="cv-web-entry cv-web-education-entry">
    <div className="cv-web-entry-meta">
      {entry.period ? <p>{entry.period}</p> : null}
      {entry.location ? <p>{entry.location}</p> : null}
    </div>
    <div className="cv-web-entry-main">
      <h3>{entry.qualification}</h3>
      <p className="cv-web-entry-summary">{entry.institution}</p>
    </div>
    <WebHighlights items={entry.details} />
  </article>
)

const AdditionalRows = ({
  entry,
}: {
  readonly entry: CvAdditionalSectionV1
}) => (
  <div className="cv-web-additional-list">
    {entry.items.map((item) => (
      <article className="cv-web-additional-entry" key={item.id}>
        <h3>{item.title ?? '—'}</h3>
        <p>{item.text}</p>
      </article>
    ))}
  </div>
)

const SectionContent = ({
  document,
  labels,
  section,
}: {
  readonly document: CvDocumentV1
  readonly labels: CvRendererLabels
  readonly section: CvWebSection
}) => {
  switch (section.kind) {
    case 'experience':
      return document.experience.map((entry) => (
        <ExperienceRow entry={entry} key={entry.id} labels={labels} />
      ))
    case 'projects':
      return document.projects.map((entry) => (
        <ProjectRow entry={entry} key={entry.id} labels={labels} />
      ))
    case 'skills':
      return document.skills.map((entry) => (
        <article className="cv-web-skill-entry" key={entry.id}>
          <h3>{entry.label}</h3>
          <p>{entry.items.join(' · ')}</p>
        </article>
      ))
    case 'education':
      return document.education.map((entry) => (
        <EducationRow entry={entry} key={entry.id} />
      ))
    case 'additional':
      return <AdditionalRows entry={section.entry} />
  }
}

const WebHeader = ({
  labels,
  presentation,
}: {
  readonly labels: CvRendererLabels
  readonly presentation: CvWebPresentation
}) => (
  <header className="cv-web-header">
    <div className="cv-web-header-inner">
      <a className="cv-web-monogram" href="#cv-web-top">
        CV<span aria-hidden="true">/</span>
      </a>
      <WebSectionNavigation
        label={labels.sectionsNavigation}
        sections={presentation.sections}
      />
      <div className="cv-web-header-actions">
        <WebPrintButton label={labels.printPdf} />
        <ColorSchemeControl labels={labels} />
      </div>
    </div>
  </header>
)

const WebHero = ({
  document,
  labels,
  presentation,
}: {
  readonly document: CvDocumentV1
  readonly labels: CvRendererLabels
  readonly presentation: CvWebPresentation
}) => {
  const firstSection = presentation.sections.at(0)

  return (
    <section className="cv-web-hero" id="cv-web-top">
      <div className="cv-web-hero-grid">
        <div className="cv-web-hero-main">
          <p className="cv-web-eyebrow">
            {'// '}
            {labels.curriculumVitae}
          </p>
          <h1 id={presentation.titleId}>{document.person.name}</h1>
          <p className="cv-web-headline">&gt; {document.person.headline}</p>
          {document.person.location ? (
            <p className="cv-web-location">{document.person.location}</p>
          ) : null}
          <p className="cv-web-summary">{document.person.summary}</p>
          <WebContacts
            contacts={document.person.contacts}
            label={labels.contactInformation}
          />
          {firstSection ? (
            <a className="cv-web-scroll-link" href={`#${firstSection.id}`}>
              {labels.exploreCv} <span aria-hidden="true">↓</span>
            </a>
          ) : null}
        </div>
        <aside className="cv-web-index">
          <p className="cv-web-index-title">
            <span aria-hidden="true">{'/* '}</span>
            {labels.index}
            <span aria-hidden="true">{' */'}</span>
          </p>
          <ol>
            {presentation.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>
                  <span>{section.index}</span>
                  <span>{section.label}</span>
                </a>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </section>
  )
}

export const WebCvRenderer = ({
  document,
  publicUrl,
  renderVersion = cvRenderContractVersion,
}: WebCvRendererProps) => {
  const labels = cvRendererLabelsForLocale(document.locale)
  const presentation = cvWebPresentation(document, labels)

  return (
    <div
      className="cv-web-document"
      data-cv-render-version={renderVersion}
      data-cv-web-document
      dir={document.direction}
      lang={document.locale}
    >
      <a className="cv-web-skip-link" href={`#${presentation.titleId}`}>
        {labels.skipToContent}
      </a>
      <WebHeader labels={labels} presentation={presentation} />
      <main aria-labelledby={presentation.titleId}>
        <WebHero
          document={document}
          labels={labels}
          presentation={presentation}
        />
        {presentation.sections.map((section) => (
          <WebSectionShell key={section.id} section={section}>
            <SectionContent
              document={document}
              labels={labels}
              section={section}
            />
          </WebSectionShell>
        ))}
      </main>
      <footer className="cv-web-footer">
        <span>{document.person.name}</span>
        <span>{labels.websiteFooter}</span>
        {publicUrl ? <a href={publicUrl}>{labels.canonicalVersion}</a> : null}
      </footer>
    </div>
  )
}
