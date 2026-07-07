import {
  contentVariableState,
  type VariableState,
} from '@/components/private-cv/variable-state'
import type { CvContent, RedactableText } from '@/cv-content/model'
import type { CvSession } from '@/lib/private-content-session/session'
import pageStyleTemplate from './page-style.css.hbs'

type PrintPageStyleContext = {
  firstPageName: string
  pageLabel: string
  sourceCode: string
}

type PrintPageStyleLabels = {
  pageLabel: string
}

const resolvedVariableText = (state: VariableState) =>
  state.status === 'resolved' && typeof state.value === 'string'
    ? state.value
    : null

const printText = (value: RedactableText, session: CvSession) =>
  typeof value === 'string'
    ? value
    : (resolvedVariableText(contentVariableState(session, value.variable)) ??
      value.fallback)

const printPageStyleContext = (
  content: CvContent,
  labels: PrintPageStyleLabels,
  session: CvSession
): PrintPageStyleContext => ({
  firstPageName: printText(content.identity.name, session),
  pageLabel: labels.pageLabel,
  sourceCode: printText(content.document.links.sourceCode.value, session),
})

export const getPrintPageStyle = (
  content: CvContent,
  labels: PrintPageStyleLabels,
  session: CvSession
) => pageStyleTemplate(printPageStyleContext(content, labels, session))
