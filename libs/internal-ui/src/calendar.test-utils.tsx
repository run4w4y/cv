import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { I18nProvider } from 'react-aria'

export const renderWithLocale = (ui: ReactElement, locale = 'en-US') =>
  render(<I18nProvider locale={locale}>{ui}</I18nProvider>)

export const getDateField = (label: string) => {
  const field = document.querySelector(`[role="group"][aria-label="${label}"]`)
  if (!(field instanceof HTMLElement)) {
    throw new Error(`Date field "${label}" was not found.`)
  }
  return field
}

export const getSegmentTypes = (field: HTMLElement) =>
  Array.from(field.querySelectorAll('[data-type]'))
    .map((element) => element.getAttribute('data-type'))
    .filter((type) => type && type !== 'literal')
