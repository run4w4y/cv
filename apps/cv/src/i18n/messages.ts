import { msg } from '@lingui/core/macro'

export const cvMessages = {
  actions: {
    exportPdf: msg({
      id: 'cv.actions.exportPdf',
      message: 'Export PDF',
    }),
    scroll: msg({
      id: 'cv.actions.scroll',
      message: 'Scroll',
    }),
    showLess: msg({
      id: 'cv.actions.showLess',
      message: 'Show less',
    }),
    showMore: msg({
      id: 'cv.actions.showMore',
      message: 'Show more',
    }),
  },
  app: {
    openCv: msg({
      id: 'cv.app.openCv',
      message: 'Open CV',
    }),
  },
  labels: {
    cvSections: msg({
      id: 'cv.labels.cvSections',
      message: 'CV sections',
    }),
    cvVersion: msg({
      id: 'cv.labels.cvVersion',
      message: 'CV v1.0.0',
    }),
    focus: msg({
      id: 'cv.labels.focus',
      message: 'Focus',
    }),
    fullWebCv: msg({
      id: 'cv.labels.fullWebCv',
      message: 'Full web CV',
    }),
    githubHandle: msg({
      id: 'cv.labels.githubHandle',
      message: 'GitHub handle',
    }),
    index: msg({
      id: 'cv.labels.index',
      message: 'Index',
    }),
    language: msg({
      id: 'cv.labels.language',
      message: 'Language',
    }),
    lastUpdated: msg({
      id: 'cv.labels.lastUpdated',
      message: 'Last updated',
    }),
    name: msg({
      id: 'cv.labels.name',
      message: 'Name',
    }),
    page: msg({
      id: 'cv.labels.page',
      message: 'Page',
    }),
    primaryNavigation: msg({
      id: 'cv.labels.primaryNavigation',
      message: 'Primary navigation',
    }),
    qrInstructions: msg({
      id: 'cv.labels.qrInstructions',
      message: 'Scan or click the QR code above to view the full CV website.',
    }),
    selectedStack: msg({
      id: 'cv.labels.selectedStack',
      message: 'Selected stack',
    }),
  },
  redaction: {
    fullAccessPrefix: msg({
      id: 'cv.redaction.fullAccessPrefix',
      message: 'For the full CV, email',
    }),
    hiddenBody: msg({
      id: 'cv.redaction.hiddenBody',
      message: 'This detail is hidden in the redacted public version.',
    }),
    hiddenTitle: msg({
      id: 'cv.redaction.hiddenTitle',
      message: 'Redacted in public CV',
    }),
    inlineFallback: msg({
      id: 'cv.redaction.inlineFallback',
      message: 'Redacted detail',
    }),
    noticeBody: msg({
      id: 'cv.redaction.noticeBody',
      message:
        'This is the public version of the CV, so some details are redacted.',
    }),
    noticeCtaPrefix: msg({
      id: 'cv.redaction.noticeCtaPrefix',
      message: 'For the full version, email',
    }),
    noticeDetail: msg({
      id: 'cv.redaction.noticeDetail',
      message:
        'Identifying details, direct contact routes, and non-public files are available only in the full version.',
    }),
    noticeTitle: msg({
      id: 'cv.redaction.noticeTitle',
      message: 'Redacted public version',
    }),
    redactedLabel: msg({
      id: 'cv.redaction.redactedLabel',
      message: 'Redacted from public CV',
    }),
    sectionAccess: msg({
      id: 'cv.redaction.sectionAccess',
      message: 'For the full CV, email',
    }),
    sectionBody: msg({
      id: 'cv.redaction.sectionBody',
      message: 'This section is hidden in the redacted public version.',
    }),
  },
  status: {
    invalid: msg({
      id: 'cv.status.invalid',
      message:
        'The full CV link could not be opened. Showing the public version.',
    }),
    loading: msg({
      id: 'cv.status.loading',
      message: 'Opening full CV...',
    }),
    unavailable: msg({
      id: 'cv.status.unavailable',
      message:
        'The full CV is unavailable right now. Showing the public version.',
    }),
    unlocked: msg({
      id: 'cv.status.unlocked',
      message: 'Full CV opened for this tab.',
    }),
  },
  theme: {
    dark: msg({
      id: 'cv.theme.dark',
      message: 'Dark theme',
    }),
    light: msg({
      id: 'cv.theme.light',
      message: 'Light theme',
    }),
    system: msg({
      id: 'cv.theme.system',
      message: 'System theme',
    }),
    theme: msg({
      id: 'cv.theme.theme',
      message: 'Theme',
    }),
  },
} as const
