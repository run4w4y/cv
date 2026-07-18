import type {
  CvAdditionalSectionV1,
  CvContactLinkV1,
  CvDocumentV1,
  CvEducationItemV1,
  CvExperienceItemV1,
  CvProjectItemV1,
  CvSkillGroupV1,
} from '@cv/contracts/document'
import type { ReactNode } from 'react'

import { CvPublicUrlQr } from './qr-code'
import { CvRendererStyleSheet } from './styles'
import {
  type CvDocumentRendererProps,
  type CvRendererLabels,
  defaultCvRendererLabels,
} from './types'

type KeyedText = {
  readonly key: string
  readonly value: string
}

const keyedTexts = (
  values: ReadonlyArray<string>
): ReadonlyArray<KeyedText> => {
  const occurrences = new Map<string, number>()

  return values.map((value) => {
    const occurrence = occurrences.get(value) ?? 0
    occurrences.set(value, occurrence + 1)
    return { key: `${value}\u0000${occurrence}`, value }
  })
}

const rendererLabels = (
  labels: Partial<CvRendererLabels> | undefined
): CvRendererLabels => ({ ...defaultCvRendererLabels, ...labels })

const idFragment = (value: string) => {
  const encoded = value.replaceAll(/[^A-Za-z0-9-]/gu, (character) =>
    Array.from(character)
      .map((part) => `_x${part.codePointAt(0)?.toString(16)}_`)
      .join('')
  )

  return encoded || 'cv'
}

const classNames = (...values: ReadonlyArray<string | undefined>) =>
  values.filter((value): value is string => Boolean(value)).join(' ')

const ContactValue = ({ contact }: { readonly contact: CvContactLinkV1 }) =>
  contact.href ? (
    <a href={contact.href}>{contact.value}</a>
  ) : (
    <span>{contact.value}</span>
  )

const Contacts = ({
  contacts,
  label,
}: {
  readonly contacts: CvDocumentV1['person']['contacts']
  readonly label: string
}) => {
  const occurrences = new Map<string, number>()

  return (
    <address aria-label={label} className="cv2-contacts">
      <ul className="cv2-contact-list">
        {contacts.map((contact) => {
          const signature = [
            contact.kind,
            contact.label,
            contact.value,
            contact.href ?? '',
          ].join('\u0000')
          const occurrence = occurrences.get(signature) ?? 0
          occurrences.set(signature, occurrence + 1)

          return (
            <li
              className="cv2-contact-item"
              key={`${signature}\u0000${occurrence}`}
            >
              <span className="cv2-contact-label">{contact.label}</span>
              <ContactValue contact={contact} />
            </li>
          )
        })}
      </ul>
    </address>
  )
}

const Section = ({
  children,
  heading,
  id,
}: {
  readonly children: ReactNode
  readonly heading: string
  readonly id: string
}) => (
  <section aria-labelledby={id} className="cv2-section">
    <h2 className="cv2-section-heading" id={id}>
      {heading}
    </h2>
    {children}
  </section>
)

const Technologies = ({
  items,
  label,
}: {
  readonly items: ReadonlyArray<string>
  readonly label: string
}) =>
  items.length === 0 ? null : (
    <ul aria-label={label} className="cv2-chip-list">
      {keyedTexts(items).map((item) => (
        <li className="cv2-chip" key={item.key}>
          {item.value}
        </li>
      ))}
    </ul>
  )

const Highlights = ({
  items,
  label,
}: {
  readonly items: ReadonlyArray<string>
  readonly label: string
}) =>
  items.length === 0 ? null : (
    <ul aria-label={label} className="cv2-highlights">
      {keyedTexts(items).map((item) => (
        <li className="cv2-highlight" key={item.key}>
          {item.value}
        </li>
      ))}
    </ul>
  )

const ExperienceEntry = ({
  entry,
  labels,
  titleId,
}: {
  readonly entry: CvExperienceItemV1
  readonly labels: CvRendererLabels
  readonly titleId: string
}) => (
  <article aria-labelledby={titleId} className="cv2-entry">
    <header className="cv2-entry-header">
      <div>
        <h3 className="cv2-entry-title" id={titleId}>
          {entry.role}
        </h3>
        <p className="cv2-entry-organization">{entry.company}</p>
      </div>
      <p className="cv2-entry-period">
        {entry.period}
        {entry.location ? (
          <span className="cv2-entry-location">{entry.location}</span>
        ) : null}
      </p>
    </header>
    {entry.summary ? (
      <p className="cv2-entry-summary">{entry.summary}</p>
    ) : null}
    <Highlights items={entry.highlights} label={labels.highlights} />
    <Technologies items={entry.technologies} label={labels.technologies} />
  </article>
)

const ProjectLinks = ({
  links,
  label,
}: {
  readonly links: ReadonlyArray<CvContactLinkV1>
  readonly label: string
}) =>
  links.length === 0 ? null : (
    <ul aria-label={label} className="cv2-link-list">
      {(() => {
        const occurrences = new Map<string, number>()

        return links.map((link) => {
          const signature = [
            link.kind,
            link.label,
            link.value,
            link.href ?? '',
          ].join('\u0000')
          const occurrence = occurrences.get(signature) ?? 0
          occurrences.set(signature, occurrence + 1)

          return (
            <li key={`${signature}\u0000${occurrence}`}>
              {link.href ? <a href={link.href}>{link.label}</a> : link.value}
            </li>
          )
        })
      })()}
    </ul>
  )

const ProjectEntry = ({
  entry,
  labels,
  titleId,
}: {
  readonly entry: CvProjectItemV1
  readonly labels: CvRendererLabels
  readonly titleId: string
}) => (
  <article aria-labelledby={titleId} className="cv2-entry">
    <header className="cv2-entry-header">
      <h3 className="cv2-entry-title" id={titleId}>
        {entry.name}
      </h3>
    </header>
    <p className="cv2-entry-summary">{entry.summary}</p>
    <Highlights items={entry.highlights} label={labels.highlights} />
    <Technologies items={entry.technologies} label={labels.technologies} />
    <ProjectLinks links={entry.links} label={labels.projectLinks} />
  </article>
)

const ExperienceSection = ({
  entries,
  idPrefix,
  labels,
}: {
  readonly entries: ReadonlyArray<CvExperienceItemV1>
  readonly idPrefix: string
  readonly labels: CvRendererLabels
}) =>
  entries.length === 0 ? null : (
    <Section heading={labels.experience} id={`${idPrefix}-experience`}>
      <ol className="cv2-entry-list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <ExperienceEntry
              entry={entry}
              labels={labels}
              titleId={`${idPrefix}-experience-${idFragment(entry.id)}`}
            />
          </li>
        ))}
      </ol>
    </Section>
  )

const ProjectsSection = ({
  entries,
  idPrefix,
  labels,
}: {
  readonly entries: ReadonlyArray<CvProjectItemV1>
  readonly idPrefix: string
  readonly labels: CvRendererLabels
}) =>
  entries.length === 0 ? null : (
    <Section heading={labels.projects} id={`${idPrefix}-projects`}>
      <ol className="cv2-entry-list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <ProjectEntry
              entry={entry}
              labels={labels}
              titleId={`${idPrefix}-project-${idFragment(entry.id)}`}
            />
          </li>
        ))}
      </ol>
    </Section>
  )

const SkillsSection = ({
  entries,
  idPrefix,
  labels,
}: {
  readonly entries: ReadonlyArray<CvSkillGroupV1>
  readonly idPrefix: string
  readonly labels: CvRendererLabels
}) =>
  entries.length === 0 ? null : (
    <Section heading={labels.skills} id={`${idPrefix}-skills`}>
      <ul className="cv2-skill-list">
        {entries.map((entry) => (
          <li className="cv2-skill-group" key={entry.id}>
            <h3 className="cv2-skill-label">{entry.label}</h3>
            <p className="cv2-skill-items">{entry.items.join(' · ')}</p>
          </li>
        ))}
      </ul>
    </Section>
  )

const EducationEntry = ({
  entry,
  labels,
  titleId,
}: {
  readonly entry: CvEducationItemV1
  readonly labels: CvRendererLabels
  readonly titleId: string
}) => (
  <article aria-labelledby={titleId} className="cv2-entry">
    <header className="cv2-entry-header">
      <div>
        <h3 className="cv2-entry-title" id={titleId}>
          {entry.qualification}
        </h3>
        <p className="cv2-entry-organization">{entry.institution}</p>
      </div>
      <p className="cv2-entry-period">
        {entry.period}
        {entry.location ? (
          <span className="cv2-entry-location">{entry.location}</span>
        ) : null}
      </p>
    </header>
    <Highlights items={entry.details} label={labels.highlights} />
  </article>
)

const EducationSection = ({
  entries,
  idPrefix,
  labels,
}: {
  readonly entries: ReadonlyArray<CvEducationItemV1>
  readonly idPrefix: string
  readonly labels: CvRendererLabels
}) =>
  entries.length === 0 ? null : (
    <Section heading={labels.education} id={`${idPrefix}-education`}>
      <ol className="cv2-entry-list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <EducationEntry
              entry={entry}
              labels={labels}
              titleId={`${idPrefix}-education-${idFragment(entry.id)}`}
            />
          </li>
        ))}
      </ol>
    </Section>
  )

const AdditionalSection = ({
  entry,
  idPrefix,
}: {
  readonly entry: CvAdditionalSectionV1
  readonly idPrefix: string
}) => (
  <Section
    heading={entry.title}
    id={`${idPrefix}-additional-${idFragment(entry.id)}`}
  >
    <ul className="cv2-additional-list">
      {entry.items.map((item) => (
        <li className="cv2-additional-item" key={item.id}>
          {item.title ? (
            <h3 className="cv2-additional-title">{item.title}</h3>
          ) : null}
          <p className="cv2-additional-text">{item.text}</p>
        </li>
      ))}
    </ul>
  </Section>
)

const PublicVersion = ({
  idPrefix,
  labels,
  publicUrl,
}: {
  readonly idPrefix: string
  readonly labels: CvRendererLabels
  readonly publicUrl: string
}) => (
  <figure className="cv2-publication" data-cv-print-only>
    <a
      aria-label={labels.publicVersionInstructions}
      className="cv2-publication-link"
      href={publicUrl}
    >
      <CvPublicUrlQr
        publicUrl={publicUrl}
        title={labels.publicVersionInstructions}
        titleId={`${idPrefix}-public-qr-title`}
      />
    </a>
    <figcaption>
      <strong className="cv2-publication-label">{labels.publicVersion}</strong>
      <span className="cv2-publication-instructions">
        {labels.publicVersionInstructions}
      </span>
      <a className="cv2-publication-url" href={publicUrl}>
        {publicUrl}
      </a>
    </figcaption>
  </figure>
)

export const CvDocumentRenderer = ({
  className,
  document,
  idPrefix = 'cv-document',
  includeStyles = true,
  labels: labelOverrides,
  mode = 'responsive',
  publicUrl,
}: CvDocumentRendererProps) => {
  const labels = rendererLabels(labelOverrides)
  const prefix = idFragment(idPrefix)
  const titleId = `${prefix}-title`

  return (
    <>
      {includeStyles ? <CvRendererStyleSheet /> : null}
      <article
        aria-labelledby={titleId}
        className={classNames('cv2-document', className)}
        data-cv-document
        data-cv-renderer-mode={mode}
        dir={document.direction}
        lang={document.locale}
      >
        <header className="cv2-header">
          <h1 className="cv2-name" id={titleId}>
            {document.person.name}
          </h1>
          <p className="cv2-headline">{document.person.headline}</p>
          {document.person.location ? (
            <p className="cv2-location">{document.person.location}</p>
          ) : null}
          <Contacts
            contacts={document.person.contacts}
            label={labels.contactInformation}
          />
        </header>

        <section aria-labelledby={`${prefix}-profile`}>
          <h2 className="cv2-visually-hidden" id={`${prefix}-profile`}>
            {labels.profile}
          </h2>
          <p className="cv2-summary">{document.person.summary}</p>
        </section>

        <div className="cv2-layout">
          <div className="cv2-column">
            <ExperienceSection
              entries={document.experience}
              idPrefix={prefix}
              labels={labels}
            />
            <ProjectsSection
              entries={document.projects}
              idPrefix={prefix}
              labels={labels}
            />
          </div>
          <div className="cv2-column">
            <SkillsSection
              entries={document.skills}
              idPrefix={prefix}
              labels={labels}
            />
            <EducationSection
              entries={document.education}
              idPrefix={prefix}
              labels={labels}
            />
            {document.additionalSections.map((entry) => (
              <AdditionalSection
                entry={entry}
                idPrefix={prefix}
                key={entry.id}
              />
            ))}
          </div>
        </div>

        {publicUrl ? (
          <PublicVersion
            idPrefix={prefix}
            labels={labels}
            publicUrl={publicUrl}
          />
        ) : null}
      </article>
    </>
  )
}
