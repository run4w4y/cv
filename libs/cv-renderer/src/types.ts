import type { CvDocumentV1 } from '@cv/contracts/document'

export type CvRendererMode = 'responsive' | 'print-preview'

export interface CvRendererLabels {
  readonly profile: string
  readonly contactInformation: string
  readonly experience: string
  readonly projects: string
  readonly skills: string
  readonly education: string
  readonly technologies: string
  readonly highlights: string
  readonly projectLinks: string
  readonly publicVersion: string
  readonly publicVersionInstructions: string
}

export const defaultCvRendererLabels: CvRendererLabels = {
  profile: 'Profile',
  contactInformation: 'Contact information',
  experience: 'Experience',
  projects: 'Selected projects',
  skills: 'Skills',
  education: 'Education',
  technologies: 'Technologies',
  highlights: 'Highlights',
  projectLinks: 'Project links',
  publicVersion: 'Current web CV',
  publicVersionInstructions: 'Scan to open the exact public version',
}

export const russianCvRendererLabels: CvRendererLabels = {
  profile: 'О себе',
  contactInformation: 'Контактная информация',
  experience: 'Опыт',
  projects: 'Проекты',
  skills: 'Навыки',
  education: 'Образование',
  technologies: 'Технологии',
  highlights: 'Основные результаты',
  projectLinks: 'Ссылки проекта',
  publicVersion: 'Актуальное резюме в интернете',
  publicVersionInstructions: 'Откройте точную публичную версию по QR-коду',
}

export const cvRendererLabelsForLocale = (locale: string): CvRendererLabels =>
  locale.toLowerCase().split('-')[0] === 'ru'
    ? russianCvRendererLabels
    : defaultCvRendererLabels

export interface CvDocumentRendererProps {
  /** Parsed `cv.document.v1` data. */
  readonly document: CvDocumentV1
  /** Exact stable publication URL encoded in the print QR code. */
  readonly publicUrl?: string
  /** Forces the A4 layout on screen for management preview. */
  readonly mode?: CvRendererMode
  /** Stable prefix for heading IDs when multiple documents share a page. */
  readonly idPrefix?: string
  /** Locale-specific renderer-owned labels. */
  readonly labels?: Partial<CvRendererLabels>
  readonly className?: string
  /** Disable when `CvRendererStyleSheet` is already mounted by the host. */
  readonly includeStyles?: boolean
}
