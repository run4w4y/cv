import type {
  CvAdditionalSectionV1,
  CvEducationItemV1,
  CvExperienceItemV1,
  CvProjectItemV1,
  CvSkillGroupV1,
} from '@cv/contracts/document'

import { EducationEntry, ExperienceEntry, ProjectEntry } from './entries'
import type { CvRendererLabels } from './labels'
import { idFragment, Section } from './primitives'

const idPrefix = 'cv-document'

export const ExperienceSection = ({
  entries,
  labels,
}: {
  readonly entries: ReadonlyArray<CvExperienceItemV1>
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

export const ProjectsSection = ({
  entries,
  labels,
}: {
  readonly entries: ReadonlyArray<CvProjectItemV1>
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

export const SkillsSection = ({
  entries,
  labels,
}: {
  readonly entries: ReadonlyArray<CvSkillGroupV1>
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

export const EducationSection = ({
  entries,
  labels,
}: {
  readonly entries: ReadonlyArray<CvEducationItemV1>
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

export const AdditionalSection = ({
  entry,
}: {
  readonly entry: CvAdditionalSectionV1
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
