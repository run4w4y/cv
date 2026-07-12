import { describe, expect, test } from 'bun:test'
import type { CampaignRecommendation } from '../ai/schema'
import { buildCampaignArtifactFiles } from './write-campaign'

const recommendation = {
  coverLetter: { body: 'Dear hiring team,', subject: 'Backend Engineer' },
  email: { body: 'Please find my CV attached.', subject: 'Application' },
  followUpQuestions: [],
  job: {
    applicationQuestions: [],
    company: 'Acme',
    concerns: [],
    coverLetterInstructions: [],
    coverLetterRequired: false,
    differentiators: [],
    hiringSignals: [],
    location: 'Remote',
    niceToHaveSignals: [],
    requiredSignals: [],
    role: 'Backend Engineer',
    routineSignals: [],
    seniority: 'Senior',
    summary: 'Build backend systems.',
    technologies: ['TypeScript'],
    workMode: 'Remote',
  },
  matchedEvidence: [],
  recommendation: {
    alternatives: [],
    audienceSlug: 'acme',
    confidence: 0.9,
    profile: 'backend',
    rationale: 'Strong fit',
  },
} satisfies CampaignRecommendation

const files = (materialsMode: 'all' | 'none') =>
  buildCampaignArtifactFiles({
    input: {
      decisions: { audience: 'acme', profile: 'backend' },
      job: {
        body: 'Job body',
        fetchedAt: '2026-07-10T00:00:00.000Z',
        url: 'https://jobs.example.com/backend',
      },
      materialsMode,
      outDir: '/tmp/campaign',
      recommendation,
      runId: 'run-id',
      status: 'succeeded',
    },
    jobMarkdown: '# Job',
    recommendationMarkdown: '# Recommendation',
  })

describe('campaign artifact builder', () => {
  test('keeps subjects in standalone applicant material files', () => {
    const artifacts = files('all')
    const coverLetter = artifacts.find(
      (file) => file.path === 'cover-letter.md'
    )
    const email = artifacts.find((file) => file.path === 'email.md')

    expect(coverLetter?.content).toContain('Subject: Backend Engineer')
    expect(coverLetter?.content).toContain('Dear hiring team,')
    expect(email?.content).toContain('Subject: Application')
    expect(email?.content).toContain('Please find my CV attached.')
  })

  test('omits applicant material files when disabled', () => {
    expect(files('none').map((file) => file.path)).not.toContain(
      'cover-letter.md'
    )
  })
})
