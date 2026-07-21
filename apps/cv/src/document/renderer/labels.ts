export interface CvRendererLabels {
  readonly additionalSectionDescription: string
  readonly canonicalVersion: string
  readonly colorScheme: string
  readonly contactInformation: string
  readonly curriculumVitae: string
  readonly darkColorScheme: string
  readonly education: string
  readonly educationDescription: string
  readonly experience: string
  readonly experienceDescription: string
  readonly exploreCv: string
  readonly highlights: string
  readonly index: string
  readonly lightColorScheme: string
  readonly printPdf: string
  readonly profile: string
  readonly projectLinks: string
  readonly projects: string
  readonly projectsDescription: string
  readonly publicVersion: string
  readonly publicVersionInstructions: string
  readonly sectionsNavigation: string
  readonly selectedWork: string
  readonly skills: string
  readonly skillsDescription: string
  readonly skipToContent: string
  readonly systemColorScheme: string
  readonly technologies: string
  readonly websiteFooter: string
}

const englishLabels: CvRendererLabels = {
  additionalSectionDescription: 'Further details and context',
  canonicalVersion: 'Current web version',
  colorScheme: 'Color scheme',
  contactInformation: 'Contact information',
  curriculumVitae: 'Curriculum vitae',
  darkColorScheme: 'Dark',
  education: 'Education',
  educationDescription: 'Study and formal foundations',
  experience: 'Experience',
  experienceDescription: 'Roles, scope and outcomes',
  exploreCv: 'Explore the CV',
  highlights: 'Highlights',
  index: 'Index',
  lightColorScheme: 'Light',
  printPdf: 'Print / PDF',
  profile: 'Profile',
  projectLinks: 'Project links',
  projects: 'Selected projects',
  projectsDescription: 'Independent and selected work',
  publicVersion: 'Current web CV',
  publicVersionInstructions: 'Scan to open the exact public version',
  sectionsNavigation: 'CV sections',
  selectedWork: 'Selected work',
  skills: 'Skills',
  skillsDescription: 'Tools, systems and practice',
  skipToContent: 'Skip to CV content',
  systemColorScheme: 'System',
  technologies: 'Technologies',
  websiteFooter: 'A website on screen · a document in print',
}

const russianLabels: CvRendererLabels = {
  additionalSectionDescription: 'Дополнительные сведения',
  canonicalVersion: 'Актуальная веб-версия',
  colorScheme: 'Цветовая схема',
  contactInformation: 'Контактная информация',
  curriculumVitae: 'Резюме',
  darkColorScheme: 'Тёмная',
  education: 'Образование',
  educationDescription: 'Обучение и профессиональная база',
  experience: 'Опыт',
  experienceDescription: 'Роли, задачи и результаты',
  exploreCv: 'Смотреть резюме',
  highlights: 'Основные результаты',
  index: 'Содержание',
  lightColorScheme: 'Светлая',
  printPdf: 'Печать / PDF',
  profile: 'О себе',
  projectLinks: 'Ссылки проекта',
  projects: 'Проекты',
  projectsDescription: 'Избранные и независимые проекты',
  publicVersion: 'Актуальное резюме в интернете',
  publicVersionInstructions: 'Откройте точную публичную версию по QR-коду',
  sectionsNavigation: 'Разделы резюме',
  selectedWork: 'Избранное',
  skills: 'Навыки',
  skillsDescription: 'Инструменты, системы и практики',
  skipToContent: 'Перейти к содержанию резюме',
  systemColorScheme: 'Системная',
  technologies: 'Технологии',
  websiteFooter: 'Сайт на экране · документ при печати',
}

export const cvRendererLabelsForLocale = (locale: string): CvRendererLabels =>
  locale.toLowerCase().split('-')[0] === 'ru' ? russianLabels : englishLabels
