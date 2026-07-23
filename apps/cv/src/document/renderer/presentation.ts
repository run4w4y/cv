import type {
  CvAdditionalSectionV1,
  CvDocumentV1,
} from '@cv/contracts/document'

import type { CvRendererLabels } from './labels'
import { idFragment } from './primitives'

export type CvWebSection =
  | {
      readonly description: string
      readonly id: string
      readonly index: string
      readonly kind: 'experience' | 'projects' | 'skills' | 'education'
      readonly label: string
    }
  | {
      readonly description: string
      readonly entry: CvAdditionalSectionV1
      readonly id: string
      readonly index: string
      readonly kind: 'additional'
      readonly label: string
    }

export interface CvWebPresentation {
  readonly sections: ReadonlyArray<CvWebSection>
  readonly titleId: string
}

type WithoutIndex<Section> = Section extends CvWebSection
  ? Omit<Section, 'index'>
  : never

type CvWebSectionInput = WithoutIndex<CvWebSection>

export const cvWebPresentation = (
  document: CvDocumentV1,
  labels: CvRendererLabels
): CvWebPresentation => {
  const sections: Array<CvWebSectionInput> = []

  if (document.experience.length > 0) {
    sections.push({
      description: labels.experienceDescription,
      id: 'cv-web-experience',
      kind: 'experience',
      label: document.experienceDuration
        ? `${labels.experience} · ${document.experienceDuration}`
        : labels.experience,
    })
  }
  if (document.projects.length > 0) {
    sections.push({
      description: labels.projectsDescription,
      id: 'cv-web-projects',
      kind: 'projects',
      label: labels.projects,
    })
  }
  if (document.skills.length > 0) {
    sections.push({
      description: labels.skillsDescription,
      id: 'cv-web-skills',
      kind: 'skills',
      label: labels.skills,
    })
  }
  if (document.education.length > 0) {
    sections.push({
      description: labels.educationDescription,
      id: 'cv-web-education',
      kind: 'education',
      label: labels.education,
    })
  }
  for (const entry of document.additionalSections) {
    sections.push({
      description: labels.additionalSectionDescription,
      entry,
      id: `cv-web-additional-${idFragment(entry.id)}`,
      kind: 'additional',
      label: entry.title,
    })
  }

  return {
    sections: sections.map((section, index) => ({
      ...section,
      index: String(index + 1).padStart(2, '0'),
    })) as ReadonlyArray<CvWebSection>,
    titleId: 'cv-web-title',
  }
}
