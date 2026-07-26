import type { CoverLetterDocument } from '@cv/application-preparation-workflow/cover-letter'
import type { CvDocumentV1 } from '@cv/contracts/document'

export const documentWorkspaceCvFixture = {
  $schema: 'cv.document.v1',
  additionalSections: [
    {
      id: 'languages',
      items: [
        {
          id: 'language.en',
          text: 'English — fluent',
        },
        {
          id: 'language.de',
          text: 'German — professional working proficiency',
        },
      ],
      title: 'Languages',
    },
  ],
  direction: 'ltr',
  education: [
    {
      details: ['Distributed systems and human-computer interaction'],
      id: 'education.tu-berlin',
      institution: 'Technical University of Berlin',
      period: '2012–2016',
      qualification: 'B.Sc. Computer Science',
    },
  ],
  experience: [
    {
      company: 'Northstar',
      highlights: [
        'Led the platform team through a zero-downtime migration serving 14 product teams.',
        'Reduced deployment lead time by 62% through paved-road tooling and service templates.',
      ],
      id: 'experience.northstar',
      location: 'Berlin · Remote',
      period: '2021–Present',
      role: 'Staff Platform Engineer',
      summary:
        'Owns the internal developer platform and reliability strategy for a multi-region product estate.',
      technologies: ['TypeScript', 'Effect', 'Kubernetes', 'PostgreSQL'],
    },
    {
      company: 'Polaris',
      highlights: [
        'Built observability standards adopted across 40 production services.',
      ],
      id: 'experience.polaris',
      period: '2018–2021',
      role: 'Senior Software Engineer',
      technologies: ['React', 'Node.js', 'OpenTelemetry'],
    },
  ],
  experienceDuration: '8+ years',
  locale: 'en',
  person: {
    contacts: [
      {
        kind: 'email',
        label: 'Email',
        value: 'ada@example.com',
      },
      {
        kind: 'linkedin',
        label: 'LinkedIn',
        value: 'linkedin.com/in/ada',
      },
    ],
    headline: 'Staff platform engineer',
    location: 'Berlin, Germany',
    name: 'Ada Example',
    summary:
      'Platform engineer who turns reliability constraints into simple product-team workflows. Combines hands-on TypeScript and distributed-systems work with pragmatic technical leadership.',
  },
  projects: [
    {
      highlights: [
        'Provides typed service boundaries and local-first development workflows.',
      ],
      id: 'project.effect-state-tree',
      links: [
        {
          kind: 'github',
          label: 'GitHub',
          value: 'github.com/ada/effect-state-tree',
        },
      ],
      name: 'Effect State Tree',
      summary:
        'Transactional document state, validation, history, and Effect Atom bindings for TypeScript applications.',
      technologies: ['Effect', 'TypeScript', 'React'],
    },
  ],
  skills: [
    {
      id: 'skills.platform',
      items: ['Platform engineering', 'Distributed systems', 'Observability'],
      label: 'Engineering',
    },
    {
      id: 'skills.tools',
      items: ['TypeScript', 'Effect', 'React', 'PostgreSQL'],
      label: 'Tools',
    },
  ],
} satisfies CvDocumentV1

export const documentWorkspaceCoverLetterFixture = {
  $schema: 'cover-letter.v1',
  body: `Dear Northstar hiring team,

I am applying for the Staff Platform Engineer role because the problem you describe—making a growing engineering organization faster without trading away reliability—is exactly the kind of work I have led.

At Northstar, I guided a zero-downtime platform migration used by 14 product teams and reduced deployment lead time by 62% through paved-road tooling. The work combined hands-on TypeScript and Kubernetes engineering with the patient organizational work required to make a platform genuinely useful.

I would welcome the chance to discuss how that experience could support your next stage of growth.

Best,
Ada Example`,
  locale: 'en',
  referenceCvRevisionId: 'cv-revision-northstar-3',
} satisfies CoverLetterDocument
