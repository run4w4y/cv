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

const englishLabels: CvRendererLabels = {
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

const russianLabels: CvRendererLabels = {
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
  locale.toLowerCase().split('-')[0] === 'ru' ? russianLabels : englishLabels
