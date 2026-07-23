import type {
  CvEducationItemV1,
  CvExperienceItemV1,
  CvProjectItemV1,
} from '@cv/contracts/document'

import type { CvRendererLabels } from './labels'
import { Highlights, ProjectLinks, Technologies } from './primitives'

export const ExperienceEntry = ({
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

export const ProjectEntry = ({
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

export const EducationEntry = ({
  entry,
  labels,
  titleId,
}: {
  readonly entry: CvEducationItemV1
  readonly labels: CvRendererLabels
  readonly titleId: string
}) => (
  <article aria-labelledby={titleId} className="cv2-entry cv2-education-entry">
    <header>
      <h3 className="cv2-skill-label cv2-education-title" id={titleId}>
        {entry.qualification}
      </h3>
      <p className="cv2-skill-items cv2-education-meta">
        <span className="cv2-education-institution">{entry.institution}</span>
        {entry.location ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{entry.location}</span>
          </>
        ) : null}
        {entry.period ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{entry.period}</span>
          </>
        ) : null}
      </p>
    </header>
    <Highlights items={entry.details} label={labels.highlights} />
  </article>
)
