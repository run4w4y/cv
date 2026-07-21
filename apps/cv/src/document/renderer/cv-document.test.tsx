import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'

import { completeCvDocument as document } from '@/fixtures/complete'
import { CvDocumentRenderer } from './cv-document'
import { cvRendererLabelsForLocale } from './labels'
import { PdfCvRenderer } from './pdf/pdf-cv'
import { cvWebPresentation } from './presentation'
import { WebCvRenderer } from './web/web-cv'

describe('CV renderers', () => {
  test('renders independent deterministic web and PDF trees', () => {
    const first = renderToStaticMarkup(
      <CvDocumentRenderer
        document={document}
        publicUrl="https://example.com/c/cv"
      />
    )
    const second = renderToStaticMarkup(
      <CvDocumentRenderer
        document={document}
        publicUrl="https://example.com/c/cv"
      />
    )

    expect(second).toBe(first)
    expect(first).toContain('data-cv-web-document="true"')
    expect(first).toContain('data-cv-pdf-document="true"')
    expect(first.match(/data-cv-document="true"/gu)).toHaveLength(1)
    expect(first).toContain('id="cv-web-title"')
    expect(first).toContain('id="cv-document-title"')
    expect(first).toContain('data-cv-renderer-mode="print"')
    expect(first).not.toContain('<style')
  })

  test('derives ordered navigation only from non-empty document sections', () => {
    const labels = cvRendererLabelsForLocale(document.locale)
    const presentation = cvWebPresentation(
      { ...document, projects: [], education: [], additionalSections: [] },
      labels
    )

    expect(
      presentation.sections.map(({ id, index }) => ({ id, index }))
    ).toEqual([
      { id: 'cv-web-experience', index: '01' },
      { id: 'cv-web-skills', index: '02' },
    ])
  })

  test('omits empty sections from the website', () => {
    const markup = renderToStaticMarkup(
      <WebCvRenderer
        document={{
          ...document,
          experience: [],
          projects: [],
          skills: [],
          education: [],
          additionalSections: [],
        }}
      />
    )

    expect(markup).not.toContain('id="cv-web-experience"')
    expect(markup).not.toContain('id="cv-web-projects"')
    expect(markup).not.toContain('id="cv-web-skills"')
    expect(markup).not.toContain('id="cv-web-education"')
  })

  test('selects website presentation labels from the document locale', () => {
    const markup = renderToStaticMarkup(
      <WebCvRenderer document={{ ...document, locale: 'ru' }} />
    )

    expect(markup).toContain('>Опыт</h2>')
    expect(markup).toContain('aria-label="Контактная информация"')
    expect(markup).toContain('aria-label="Разделы резюме"')
  })

  test('integrates the exact publication URL into the dedicated A4 preview', () => {
    const publicUrl = 'https://cv.example.com/c/stable-token'
    const markup = renderToStaticMarkup(
      <PdfCvRenderer document={document} publicUrl={publicUrl} />
    )

    expect(markup).toContain('data-cv-renderer-mode="print-preview"')
    expect(markup).toContain('data-cv-print-only="true"')
    expect(markup).toContain(`data-cv-public-url="${publicUrl}"`)
    expect(markup).toContain(`href="${publicUrl}"`)
    expect(markup).toContain('cv2-header-with-publication')
    expect(markup.indexOf('data-cv-print-only="true"')).toBeLessThan(
      markup.indexOf('</header>')
    )
    expect(markup).not.toContain('data-cv-web-document')
  })
})
