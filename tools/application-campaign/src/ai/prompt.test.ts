import { describe, expect, test } from 'bun:test'
import type { CvContent } from '@cv/cv/content-model'
import { BunServices } from '@effect/platform-bun'
import { Effect } from 'effect'
import { renderProfilesMarkdown } from '../profiles/render-full'
import { renderProfileSummariesMarkdown } from '../profiles/render-summary'
import { resolveProfileVariables } from '../profiles/variables'
import {
  renderProfileShortlistPrompt,
  renderRecommendationPrompt,
} from './prompt'

const profileContent = {
  contact: {
    contact: [
      {
        href: 'mailto:test@example.com',
        label: 'Email',
        value: 'test@example.com',
      },
    ],
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
        href: 'https://github.com/example',
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
    name: {
      fallback: 'Full name hidden',
      kind: 'VariableLookup',
      label: 'Name',
      variable: 'person.name',
    },
    role: 'Senior Backend Engineer',
    summary: 'Builds APIs and distributed systems.',
    timezone: 'UTC',
  },
  profile: {
    headline: 'Backend systems',
    label: 'Go Backend',
    lastUpdated: '2026-07-08',
    locale: 'en',
    slug: 'go-backend',
    summary: 'Backend-focused profile.',
    targetRole: 'Backend Engineer',
  },
  provenance: {
    notes: ['test'],
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
            { text: 'Go APIs, PostgreSQL, distributed systems.', type: 'text' },
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
          workstreams: [],
        },
      ],
      label: 'Experience',
      type: 'experience',
    },
    {
      id: 'projects',
      index: '03',
      items: [],
      label: 'Projects',
      type: 'projects',
    },
    {
      id: 'skills',
      index: '04',
      items: [{ group: 'Backend', items: ['Go', 'PostgreSQL'] }],
      label: 'Skills',
      printStack: ['Distributed systems'],
      type: 'skills',
    },
    {
      id: 'education',
      index: '05',
      items: [],
      label: 'Education',
      type: 'education',
    },
  ],
} as const satisfies CvContent

const rawProfileCatalog = {
  content: {
    en: {
      'go-backend': profileContent,
    },
  },
  locales: ['en'],
  profiles: ['go-backend'],
  variableSource: {
    variables: {
      'person.name': 'Example Engineer',
    },
  },
}

const profileCatalog = {
  ...rawProfileCatalog,
  resolvedVariables: new Map([['person.name', 'Example Engineer']]),
}

describe('application campaign prompt rendering', () => {
  test('passes the full fetched job body into prompts', async () => {
    const lateJobDetails = [
      'Required Qualifications',
      'Own technical strategy for a product line.',
      'Lead architecture standards across many engineers.',
    ].join('\n')
    const prompt = await Effect.runPromise(
      renderProfileShortlistPrompt({
        fixedProfile: 'go-backend',
        job: {
          body: `${'x'.repeat(27_000)}\n${lateJobDetails}`,
          fetchedAt: '2026-07-08T00:00:00.000Z',
          url: 'https://jobs.example.com/backend',
        },
        locale: 'en',
        profileSummaries: '## go-backend\nBackend-focused profile.',
      }).pipe(Effect.provide(BunServices.layer))
    )

    expect(prompt).toContain(lateJobDetails)
    expect(prompt).not.toContain('[truncated]')
  })

  test('fails before prompting when private variables cannot be resolved', async () => {
    await expect(
      Effect.runPromise(
        resolveProfileVariables({
          catalog: {
            ...rawProfileCatalog,
            variableSource: null,
          },
          locale: 'en',
          profiles: ['go-backend'],
        })
      )
    ).rejects.toThrow('Could not resolve private content variable')
  })

  test('renders a first-pass shortlist prompt with profile summaries', async () => {
    const prompt = await Effect.runPromise(
      Effect.gen(function* () {
        const profileSummaries = yield* renderProfileSummariesMarkdown({
          catalog: profileCatalog,
          locale: 'en',
          profiles: ['go-backend'],
        })

        return yield* renderProfileShortlistPrompt({
          fixedProfile: 'go-backend',
          job: {
            body: '<html><body>Build backend APIs with Go and PostgreSQL.</body></html>',
            fetchedAt: '2026-07-08T00:00:00.000Z',
            url: 'https://jobs.example.com/backend',
          },
          locale: 'en',
          profileSummaries,
        })
      }).pipe(Effect.provide(BunServices.layer))
    )

    expect(prompt).toContain('Preferred campaign locale: en')
    expect(prompt).toContain('Request only the fixed profile "go-backend"')
    expect(prompt).toContain('## go-backend')
    expect(prompt).toContain('Backend-focused profile.')
    expect(prompt).toContain('Example Engineer')
    expect(prompt).not.toContain('Full name hidden')
    expect(prompt).toContain('Go APIs, PostgreSQL, distributed systems.')
    expect(prompt).toContain('Build backend APIs with Go and PostgreSQL.')
  })

  test('renders a final recommendation prompt with requested profile markdown', async () => {
    const prompt = await Effect.runPromise(
      Effect.gen(function* () {
        const profileMarkdown = yield* renderProfilesMarkdown({
          catalog: profileCatalog,
          locale: 'en',
          profiles: ['go-backend'],
        })

        return yield* renderRecommendationPrompt({
          fixedAudience: 'acme',
          fixedProfile: 'go-backend',
          job: {
            body: '<html><body>Build backend APIs with Go and PostgreSQL.</body></html>',
            fetchedAt: '2026-07-08T00:00:00.000Z',
            url: 'https://jobs.example.com/backend',
          },
          locale: 'en',
          materialsMode: 'all',
          profileMarkdown,
          profileShortlist: {
            job: {
              applicationQuestions: [],
              company: 'Acme',
              concerns: [],
              coverLetterInstructions: [],
              coverLetterRequired: false,
              differentiators: ['Distributed systems ownership'],
              hiringSignals: ['Go'],
              location: 'Remote',
              niceToHaveSignals: ['PostgreSQL'],
              requiredSignals: ['Build APIs'],
              role: 'Backend Engineer',
              routineSignals: ['API documentation'],
              seniority: 'Senior',
              summary: 'Backend role',
              technologies: ['Go', 'PostgreSQL'],
              workMode: 'Remote',
            },
            profileShortlist: [
              {
                evidenceNeeded: ['Go APIs', 'PostgreSQL'],
                profile: 'go-backend',
                rationale: 'Backend-focused profile.',
              },
            ],
          },
        })
      }).pipe(Effect.provide(BunServices.layer))
    )

    expect(prompt).toContain('Preferred locale: en')
    expect(prompt).toContain('Use the fixed profile "go-backend"')
    expect(prompt).toContain('Use the fixed audience slug "acme"')
    expect(prompt).toContain('Draft the applicant-facing cover letter')
    expect(prompt).toContain('# Profile: go-backend')
    expect(prompt).toContain('Backend platform work.')
    expect(prompt).toContain('- Name: Example Engineer')
    expect(prompt).not.toContain('Full name hidden')
    expect(prompt).toContain('"profile": "go-backend"')
    expect(prompt).toContain('nice-to-have')
    expect(prompt).toContain('brief cover note')
    expect(prompt).toContain('Do not write a proof-of-fit essay')
    expect(prompt).toContain('short introduction accompanying the CV')
    expect(prompt).toContain('Use at most two evidence themes')
    expect(prompt).toContain('name at most 4 specific technologies')
    expect(prompt).toContain(
      'Do not copy matched evidence into the cover letter'
    )
    expect(prompt).toContain('Avoid abstract fit language')
    expect(prompt).toContain('Keep the closing low-key')
    expect(prompt).toContain('Do not add an enthusiasm sentence')
    expect(prompt).toContain('Do not mention previous employer names')
    expect(prompt).toContain('Do not mention language certificates')
    expect(prompt).toContain('Build backend APIs with Go and PostgreSQL.')
  })

  test('can render final recommendation prompts without applicant materials', async () => {
    const prompt = await Effect.runPromise(
      Effect.gen(function* () {
        const profileMarkdown = yield* renderProfilesMarkdown({
          catalog: profileCatalog,
          locale: 'en',
          profiles: ['go-backend'],
        })

        return yield* renderRecommendationPrompt({
          fixedAudience: 'acme',
          fixedProfile: 'go-backend',
          job: {
            body: 'Build backend APIs with Go and PostgreSQL.',
            fetchedAt: '2026-07-08T00:00:00.000Z',
            url: 'https://jobs.example.com/backend',
          },
          locale: 'en',
          materialsMode: 'none',
          profileMarkdown,
          profileShortlist: {
            job: {
              applicationQuestions: [],
              company: 'Acme',
              concerns: [],
              coverLetterInstructions: [],
              coverLetterRequired: false,
              differentiators: ['Distributed systems ownership'],
              hiringSignals: ['Go'],
              location: 'Remote',
              niceToHaveSignals: ['PostgreSQL'],
              requiredSignals: ['Build APIs'],
              role: 'Backend Engineer',
              routineSignals: ['API documentation'],
              seniority: 'Senior',
              summary: 'Backend role',
              technologies: ['Go', 'PostgreSQL'],
              workMode: 'Remote',
            },
            profileShortlist: [
              {
                evidenceNeeded: ['Go APIs', 'PostgreSQL'],
                profile: 'go-backend',
                rationale: 'Backend-focused profile.',
              },
            ],
          },
        })
      }).pipe(Effect.provide(BunServices.layer))
    )

    expect(prompt).toContain('Do not draft applicant-facing cover letter')
    expect(prompt).toContain('Return empty strings for coverLetter.subject')
  })

  test('renders a one-pass recommendation prompt when no shortlist is needed', async () => {
    const prompt = await Effect.runPromise(
      renderRecommendationPrompt({
        fixedProfile: 'go-backend',
        job: {
          body: 'Build backend APIs.',
          fetchedAt: '2026-07-08T00:00:00.000Z',
          url: 'https://jobs.example.com/backend',
        },
        locale: 'en',
        materialsMode: 'all',
        profileMarkdown: '# Profile: go-backend',
      }).pipe(Effect.provide(BunServices.layer))
    )

    expect(prompt).toContain('No separate first-pass analysis was needed')
    expect(prompt).toContain('No shortlist was needed')
  })
})
