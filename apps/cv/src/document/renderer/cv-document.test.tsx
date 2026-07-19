import { describe, expect, test } from 'bun:test'
import type { CvDocumentV1 } from '@cv/contracts/document'
import { renderToStaticMarkup } from 'react-dom/server'

import { CvDocumentRenderer } from './cv-document'

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
    const first = renderToStaticMarkup(
      <CvDocumentRenderer document={document} />
    )
    const second = renderToStaticMarkup(
      <CvDocumentRenderer document={document} />
    )

    expect(second).toBe(first)
    expect(first).toContain('<article aria-labelledby="cv-document-title"')
    expect(first).toContain('dir="ltr" lang="en"')
    expect(first).toContain('<h1 class="cv2-name"')
    expect(first).toContain('<address aria-label="Contact information"')
    expect(first).toContain('<section aria-labelledby="cv-document-experience"')
    expect(first).toContain('<section aria-labelledby="cv-document-projects"')
    expect(first).toContain('<section aria-labelledby="cv-document-skills"')
    expect(first).toContain('<section aria-labelledby="cv-document-education"')
    expect(first).not.toContain('<style')
  })

  test('omits empty sections', () => {
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

    expect(markup).not.toContain('id="cv-document-experience"')
    expect(markup).not.toContain('id="cv-document-projects"')
    expect(markup).not.toContain('id="cv-document-skills"')
    expect(markup).not.toContain('id="cv-document-education"')
  })

  test('selects presentation labels from the document locale', () => {
    const markup = renderToStaticMarkup(
      <CvDocumentRenderer document={{ ...document, locale: 'ru' }} />
    )

    expect(markup).toContain('>Опыт</h2>')
    expect(markup).toContain('>О себе</h2>')
    expect(markup).toContain('aria-label="Контактная информация"')
  })

  test('integrates the exact publication URL into the A4 preview', () => {
    const publicUrl = 'https://cv.example.com/c/stable-token'
    const markup = renderToStaticMarkup(
      <CvDocumentRenderer
        document={document}
        mode="print-preview"
        publicUrl={publicUrl}
      />
    )

    expect(markup).toContain('data-cv-renderer-mode="print-preview"')
    expect(markup).toContain('data-cv-print-only="true"')
    expect(markup).toContain(`data-cv-public-url="${publicUrl}"`)
    expect(markup).toContain(`href="${publicUrl}"`)
  })
})
