import { describe, expect, test } from 'bun:test'
import type { CvContent } from '@cv/cv/content-model'
import { profileSlugsWithContent } from './catalog'

const profileContent = {
  contact: {
    contact: [],
    labels: {},
    social: [],
  },
  document: {
    actions: {
      exportPdf: 'Export PDF',
      scroll: 'Scroll',
    },
    dir: 'ltr',
    footer: {
      copyright: 'Test',
      stack: 'Test stack',
    },
    labels: {},
    links: {
      githubProfile: {
        href: 'https://example.com',
        label: 'GitHub',
        value: 'example',
      },
      sourceCode: {
        href: 'https://example.com/source',
        label: 'Source',
        value: 'source',
      },
    },
    meta: {
      description: 'Test profile',
      title: 'Test CV',
    },
    nav: ['about', 'experience', 'projects', 'skills', 'education'],
  },
  identity: {
    handle: 'example',
    headline: 'Backend engineer',
    initials: 'EX',
    lastUpdated: '2026-07-08',
    location: 'Remote',
    name: 'Example Engineer',
    role: 'Senior Backend Engineer',
    summary: 'Builds APIs and distributed systems.',
    timezone: 'UTC',
  },
  profile: {
    headline: 'Go backend profile',
    label: 'Go Backend',
    lastUpdated: '2026-07-08',
    locale: 'en',
    slug: 'go-backend',
    summary: 'Backend-focused profile.',
    targetRole: 'Backend Engineer',
  },
  provenance: {
    notes: ['Composed from test content'],
    source: 'test',
  },
  sections: [
    {
      id: 'about',
      index: '01',
      items: [
        {
          id: 'summary',
          blocks: [
            { text: 'Go APIs and distributed systems.', type: 'text' },
            {
              label: 'Availability',
              type: 'detail',
              value: 'Remote-friendly',
            },
          ],
        },
      ],
      label: 'Profile',
      type: 'profile',
    },
    {
      id: 'experience',
      index: '02',
      items: [
        {
          company: 'Example',
          highlights: ['Designed backend APIs'],
          location: 'Remote',
          period: '2022-present',
          stack: ['Go', 'PostgreSQL'],
          summary: 'Backend platform work.',
          title: 'Senior Engineer',
          workstreams: [{ summary: 'API design', title: 'Platform' }],
        },
      ],
      label: 'Experience',
      type: 'experience',
    },
    {
      id: 'projects',
      index: '03',
      items: [
        {
          links: [],
          name: 'Campaign tool',
          stack: ['TypeScript', 'Effect'],
          summary: 'Application workflow automation.',
          visibility: 'public',
        },
      ],
      label: 'Projects',
      type: 'projects',
    },
    {
      id: 'skills',
      index: '04',
      items: [
        {
          group: 'Backend',
          items: ['Go'],
          subgroups: [{ group: 'Storage', items: ['PostgreSQL'] }],
        },
      ],
      label: 'Skills',
      printStack: ['Distributed systems'],
      type: 'skills',
    },
    {
      id: 'education',
      index: '05',
      items: [
        {
          degree: 'BS Computer Science',
          details: 'Systems focus',
          institution: 'Example University',
          location: 'Remote',
          period: '2015-2019',
          thesis: {
            links: [],
            summary: 'Distributed systems research.',
            title: 'Thesis',
          },
        },
      ],
      label: 'Education',
      type: 'education',
    },
  ],
} as const satisfies CvContent

describe('profile discovery', () => {
  test('discovers profiles with composed CV content', () => {
    const profileCatalog = {
      content: {
        en: {
          'go-backend': profileContent,
        },
      },
      locales: ['en'],
      profiles: ['go-backend', 'missing'],
      variableSource: null,
    }

    expect(profileSlugsWithContent(profileCatalog)).toEqual(['go-backend'])
  })
})
