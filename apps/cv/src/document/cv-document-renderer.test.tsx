import { describe, expect, test } from 'bun:test'
import type { CvDocumentV1 } from '@cv/contracts/document'
import { renderToStaticMarkup } from 'react-dom/server'

import { CvDocumentRenderer } from './cv-document-renderer'

const document: CvDocumentV1 = {
  $schema: 'cv.document.v1',
  locale: 'en',
  direction: 'ltr',
  person: {
    name: 'Ada Lovelace',
    headline: 'Software engineer',
    location: 'London, UK',
    summary: 'Builds reliable systems from reviewed evidence.',
    contacts: [
      {
        kind: 'email',
        label: 'Email',
        value: 'ada@example.com',
        href: 'mailto:ada@example.com',
      },
      {
        kind: 'github',
        label: 'GitHub',
        value: 'github.com/ada',
        href: 'https://github.com/ada',
      },
    ],
  },
  experience: [
    {
      id: 'experience.engine',
      company: 'Analytical Engines',
      role: 'Engineer',
      period: '2022–present',
      location: 'Remote',
      summary: 'Owns deterministic computation systems.',
      highlights: ['Improved correctness', 'Improved correctness'],
      technologies: ['TypeScript', 'Effect'],
    },
  ],
  projects: [
    {
      id: 'project.notes',
      name: 'Notes',
      summary: 'A technical publication project.',
      highlights: ['Published reviewed explanations'],
      technologies: ['Markdown'],
      links: [
        {
          kind: 'website',
          label: 'Read',
          value: 'example.com/notes',
          href: 'https://example.com/notes',
        },
      ],
    },
  ],
  skills: [
    {
      id: 'skills.platform',
      label: 'Platform',
      items: ['TypeScript', 'Cloudflare Workers'],
    },
  ],
  education: [
    {
      id: 'education.mathematics',
      institution: 'University of London',
      qualification: 'Mathematics',
      period: '1830–1835',
      details: ['Independent study'],
    },
  ],
  additionalSections: [
    {
      id: 'additional.languages',
      title: 'Languages',
      items: [
        {
          id: 'language.english',
          title: 'English',
          text: 'Native proficiency',
        },
      ],
    },
  ],
}

describe('CvDocumentRenderer', () => {
  test('renders deterministic semantic markup from the v1 document', () => {
    const props = {
      document,
      idPrefix: 'application-42',
      includeStyles: false,
    } as const
    const first = renderToStaticMarkup(<CvDocumentRenderer {...props} />)
    const second = renderToStaticMarkup(<CvDocumentRenderer {...props} />)

    expect(second).toBe(first)
    expect(first).toContain('<article aria-labelledby="application-42-title"')
    expect(first).toContain('dir="ltr" lang="en"')
    expect(first).toContain('<h1 class="cv2-name"')
    expect(first).toContain('<address aria-label="Contact information"')
    expect(first).toContain(
      '<section aria-labelledby="application-42-experience"'
    )
    expect(first).toContain(
      '<section aria-labelledby="application-42-projects"'
    )
    expect(first).toContain('<section aria-labelledby="application-42-skills"')
    expect(first).toContain(
      '<section aria-labelledby="application-42-education"'
    )
    expect(first).not.toContain('data-cv-renderer-styles')
  })

  test('includes scoped styles by default and omits empty sections', () => {
    const markup = renderToStaticMarkup(
      <CvDocumentRenderer
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

    expect(markup).toContain('<style data-cv-renderer-styles="true">')
    expect(markup).not.toContain('id="cv-document-experience"')
    expect(markup).not.toContain('id="cv-document-projects"')
    expect(markup).not.toContain('id="cv-document-skills"')
    expect(markup).not.toContain('id="cv-document-education"')
  })

  test('selects presentation labels from the document locale', () => {
    const markup = renderToStaticMarkup(
      <CvDocumentRenderer
        document={{ ...document, locale: 'ru' }}
        includeStyles={false}
      />
    )

    expect(markup).toContain('>Опыт</h2>')
    expect(markup).toContain('>О себе</h2>')
    expect(markup).toContain('aria-label="Контактная информация"')
  })

  test('integrates the exact publication URL into the A4 preview', () => {
    const publicUrl = 'https://cv.example.com/c/stable-token?from=email&copy=1'
    const markup = renderToStaticMarkup(
      <CvDocumentRenderer
        document={document}
        includeStyles={false}
        mode="print-preview"
        publicUrl={publicUrl}
      />
    )

    const escapedUrl = publicUrl.replaceAll('&', '&amp;')
    expect(markup).toContain('data-cv-renderer-mode="print-preview"')
    expect(markup).toContain('data-cv-print-only="true"')
    expect(markup).toContain(`data-cv-public-url="${escapedUrl}"`)
    expect(markup).toContain(`href="${escapedUrl}"`)
  })
})
