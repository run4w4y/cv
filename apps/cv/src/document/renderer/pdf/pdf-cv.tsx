import { cvRenderContractVersion } from '../../version'
import { cvRendererLabelsForLocale } from '../labels'
import { Contacts } from '../primitives'
import {
  AdditionalSection,
  EducationSection,
  ExperienceSection,
  ProjectsSection,
  SkillsSection,
} from '../sections'
import type { CvDocumentRendererProps } from '../types'

export type PdfCvRendererProps = CvDocumentRendererProps & {
  readonly presentation?: 'preview' | 'print'
}

export const PdfCvRenderer = ({
  document,
  presentation = 'preview',
  publicUrl,
  renderVersion = cvRenderContractVersion,
}: PdfCvRendererProps) => {
  const labels = cvRendererLabelsForLocale(document.locale)
  const titleId = 'cv-document-title'

  return (
    <article
      aria-labelledby={titleId}
      className={`cv2-document cv-pdf-document cv-pdf-${presentation}`}
      data-cv-document
      data-cv-pdf-document
      data-cv-renderer-mode={
        presentation === 'preview' ? 'print-preview' : 'print'
      }
      data-cv-render-version={renderVersion}
      dir={document.direction}
      lang={document.locale}
    >
      <header className="cv2-header">
        <div className="cv2-header-identity">
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
          {publicUrl ? (
            <p className="cv2-publication" data-cv-print-only>
              <span className="cv2-publication-label">
                {labels.publicVersion}
              </span>
              <a
                className="cv2-publication-link"
                data-cv-public-url={publicUrl}
                href={publicUrl}
              >
                {publicUrl}
              </a>
            </p>
          ) : null}
        </div>
      </header>

      <section aria-labelledby="cv-document-profile">
        <h2 className="cv2-visually-hidden" id="cv-document-profile">
          {labels.profile}
        </h2>
        <p className="cv2-summary">{document.person.summary}</p>
      </section>

      <div className="cv2-layout">
        <ExperienceSection
          duration={document.experienceDuration}
          entries={document.experience}
          labels={labels}
        />
        <ProjectsSection entries={document.projects} labels={labels} />
        <SkillsSection entries={document.skills} labels={labels} />
        <EducationSection entries={document.education} labels={labels} />
        {document.additionalSections.map((entry) => (
          <AdditionalSection entry={entry} key={entry.id} />
        ))}
      </div>
    </article>
  )
}
