import { type CvDocumentV1, CvDocumentV1Schema } from '@cv/contracts/document'
import { Schema } from 'effect'

import { completeCvDocument } from './complete'

const baseExperience = completeCvDocument.experience[0]
const baseProject = completeCvDocument.projects[0]

if (!baseExperience || !baseProject) {
  throw new Error(
    'The complete CV fixture must contain experience and project entries.'
  )
}

const overflowDocument = {
  ...completeCvDocument,
  person: {
    ...completeCvDocument.person,
    summary: `${completeCvDocument.person.summary} This intentionally dense development fixture exercises the one-page overflow guard at valid schema limits.`,
  },
  experience: Array.from({ length: 6 }, (_, index) => ({
    ...baseExperience,
    id: `experience.overflow.${index + 1}`,
    period: `${2018 + index}–${2019 + index}`,
    role: `${baseExperience.role} ${index + 1}`,
    highlights: Array.from(
      { length: 7 },
      (__, highlightIndex) =>
        `${baseExperience.highlights[highlightIndex % baseExperience.highlights.length]} This extended fixture line verifies that valid long content cannot silently escape the PDF page boundary.`
    ),
  })),
  projects: Array.from({ length: 5 }, (_, index) => ({
    ...baseProject,
    id: `project.overflow.${index + 1}`,
    name: `${baseProject.name} ${index + 1}`,
  })),
} satisfies CvDocumentV1

export const overflowCvDocument: CvDocumentV1 =
  Schema.decodeUnknownSync(CvDocumentV1Schema)(overflowDocument)
