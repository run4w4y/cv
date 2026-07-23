import { afterEach, describe, expect, test } from 'bun:test'
import {
  type CvGenerationGuidanceV1,
  cvDocumentV1ContractId,
  cvGenerationGuidanceTargets,
  cvGenerationGuidanceV1ContractId,
} from '@cv/contracts/document'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import {
  FactsReader,
  type LoadedActiveFactsRelease,
  type LoadedFactsCatalogue,
} from '@cv/facts-reader/reader'
import { cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import { Effect, Layer } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { BrowserRouter } from 'react-router'

import { HeaderActionsProvider } from '../../../shell/header-actions'
import { renderWithRegistry } from '../../../test/render-with-registry'
import { factsDataRuntime } from '../../data/runtime'
import { FactsPage } from './render'

const digest = 'a'.repeat(64)
const releaseId = `fr_${digest}`
const descriptor = {
  byteLength: 1,
  mediaType: 'application/json',
  sha256: digest,
} as const

const activeRelease = {
  current: {
    $schema: 'cv.facts-current.v2',
    manifest: descriptor,
    releaseId,
  },
  etag: 'facts-etag',
  locales: ['en', 'ru'],
  manifest: {
    $schema: 'cv.facts-release.v2',
    assets: [
      { fileName: 'architecture.png', id: 'architecture', object: descriptor },
    ],
    catalogues: [
      { locale: 'en', object: descriptor },
      { locale: 'ru', object: descriptor },
    ],
    factsContract: 'cv.facts.v1',
    generationGuidance: {
      contract: cvGenerationGuidanceV1ContractId,
      documentContract: cvDocumentV1ContractId,
      object: descriptor,
    },
    provenance: {
      compiler: { commit: 'b'.repeat(40), repository: 'run4w4y/cv' },
      source: { commit: 'c'.repeat(40), repository: 'run4w4y/cv-content' },
    },
  },
  releaseId,
} satisfies LoadedActiveFactsRelease

const refreshedReleaseId = `fr_${'d'.repeat(64)}`
const refreshedActiveRelease = {
  ...activeRelease,
  current: { ...activeRelease.current, releaseId: refreshedReleaseId },
  releaseId: refreshedReleaseId,
} satisfies LoadedActiveFactsRelease

const reviewedFact = (id: string, text: string) => ({ id, text })

const catalogue = (locale: string): FactsCatalogueV1 => ({
  $schema: 'cv.facts.v1',
  locale,
  evidence: [
    {
      id: 'review-notes',
      kind: 'personal-review',
      note: 'Reviewed against the source material.',
      title: 'Review notes',
    },
  ],
  assets: [
    {
      description: 'Architecture diagram used as private audit context.',
      id: 'architecture',
      label: 'Architecture diagram',
      mediaType: 'image/png',
      sha256: digest,
    },
  ],
  sections: [
    {
      kind: 'identity',
      name: locale === 'ru' ? 'Марат' : 'Marat',
      headline: 'Platform engineer',
      overview: reviewedFact('identity-overview', 'Builds dependable systems.'),
      facts: [
        reviewedFact('identity-fact', 'Works across product boundaries.'),
      ],
      languages: [{ id: 'english', name: 'English', proficiency: 'Fluent' }],
    },
    {
      kind: 'contact',
      items: [
        {
          id: 'website',
          kind: 'website',
          value: 'https://example.test',
          url: 'https://example.test',
          visibility: 'public',
        },
      ],
    },
    {
      kind: 'education',
      entries: [
        {
          id: 'education-example',
          institution: 'Example University',
          degree: 'MSc Computer Science',
          period: '2015–2017',
          details: [
            reviewedFact('education-detail', 'Studied distributed systems.'),
          ],
        },
      ],
    },
    {
      kind: 'experience',
      entries: [
        {
          id: 'experience-example',
          company: 'Example Company',
          companyVisibility: 'public',
          period: '2024–present',
          roles: ['Staff Engineer'],
          highlights: [
            reviewedFact('experience-highlight', 'Built a registry.'),
          ],
          workstreams: [
            {
              id: 'facts-workstream',
              title: 'Verified facts',
              contributions: [
                reviewedFact(
                  'facts-reader',
                  'Designed verified facts reads with integrity checks.'
                ),
              ],
              technologies: ['Effect', 'React'],
            },
          ],
          technologies: ['TypeScript'],
        },
      ],
    },
    {
      kind: 'projects',
      entries: [
        {
          id: 'project-registry',
          name: 'Application Registry',
          visibility: 'private',
          summary: reviewedFact('project-summary', 'Tracks job applications.'),
          links: [],
          contributions: [
            {
              id: 'project-ui',
              title: 'Management UI',
              facts: [
                reviewedFact('project-ui-fact', 'Built the React interface.'),
              ],
              technologies: ['React'],
            },
          ],
          technologies: ['TypeScript'],
        },
      ],
    },
    {
      kind: 'skills',
      groups: [
        {
          id: 'skill-group-platform',
          title: 'Platform engineering',
          skills: [
            {
              id: 'skill-effect',
              name: 'Effect',
              details: reviewedFact(
                'skill-effect-detail',
                'Builds typed workflows.'
              ),
            },
          ],
        },
      ],
    },
  ],
})

const generationGuidance: CvGenerationGuidanceV1 = {
  $schema: cvGenerationGuidanceV1ContractId,
  documentContract: cvDocumentV1ContractId,
  fields: cvGenerationGuidanceTargets.map(({ id }) => ({
    instruction: `Write ${id} only from reviewed inputs.`,
    sources: ['trusted-facts'] as const,
    target: id,
  })),
  instruction: 'Produce a truthful CV from reviewed facts.',
  label: 'Reviewed CV guidance',
  rules: ['Never invent facts.'],
  sources: ['trusted-facts'],
}

const loadedRelease = (
  active: LoadedActiveFactsRelease,
  locale: string
): LoadedFactsCatalogue => ({
  ...active,
  catalogue: catalogue(locale),
  generationGuidance,
})

const makeFactsLayer = (
  reads: string[],
  activeReleases: ReadonlyArray<LoadedActiveFactsRelease>
) => {
  let activeReadIndex = 0
  const service = FactsReader.of({
    read: () => Effect.die('The page must reuse its verified active release.'),
    readActiveRelease: () =>
      Effect.sync(() => {
        reads.push('active')
        const active =
          activeReleases[
            Math.min(activeReadIndex, activeReleases.length - 1)
          ] ?? activeRelease
        activeReadIndex += 1
        return active
      }),
    readForActiveRelease: (active, locale) =>
      Effect.sync(() => {
        reads.push(`catalogue:${locale}`)
        return loadedRelease(active, locale)
      }),
    readGenerationGuidance: () =>
      Effect.succeed({ ...activeRelease, generationGuidance }),
  })
  return Layer.succeed(FactsReader, service)
}

const renderFactsPage = (
  path = '/facts',
  activeReleases: ReadonlyArray<LoadedActiveFactsRelease> = [activeRelease]
) => {
  window.history.replaceState(null, '', path)
  const reads: string[] = []
  const headerTarget = document.createElement('div')
  headerTarget.dataset.testid = 'facts-header-target'
  document.body.append(headerTarget)
  const view = renderWithRegistry(
    <BrowserRouter>
      <HeaderActionsProvider target={headerTarget}>
        <FactsPage />
      </HeaderActionsProvider>
    </BrowserRouter>,
    {
      initialValues: [
        Atom.initialValue(
          factsDataRuntime.layer,
          makeFactsLayer(reads, activeReleases)
        ),
      ],
    }
  )
  return Object.assign(view, { headerTarget, reads })
}

afterEach(() => {
  cleanup()
  document
    .querySelectorAll('[data-testid="facts-header-target"]')
    .forEach((element) => {
      element.remove()
    })
  window.history.replaceState(null, '', '/')
})

describe('FactsPage', () => {
  test('renders every facts section and the release support records', async () => {
    const view = renderFactsPage()

    expect(await view.findByText('Marat')).toBeTruthy()
    for (const section of [
      'Identity',
      'Contact',
      'Education',
      'Experience',
      'Projects',
      'Skills',
    ]) {
      expect(view.getByText(section)).toBeTruthy()
    }
    expect(
      view.getByText('Designed verified facts reads with integrity checks.')
    ).toBeTruthy()
    expect(view.getByText('Read-only by design')).toBeTruthy()
    expect(view.container.textContent).toContain(releaseId)

    fireEvent.click(view.getByRole('tab', { name: 'Evidence · 1' }))
    expect(await view.findByText('Review notes')).toBeTruthy()
    fireEvent.click(view.getByRole('tab', { name: 'Assets · 1' }))
    expect(await view.findByText('Architecture diagram')).toBeTruthy()
    fireEvent.click(view.getByRole('tab', { name: 'Generation guidance' }))
    expect(await view.findByText('Reviewed CV guidance')).toBeTruthy()
    expect(view.reads).toEqual(['active', 'catalogue:en'])
  })

  test('switches locale through the header and stores it in the URL', async () => {
    const view = renderFactsPage()
    await view.findByText('Marat')

    fireEvent.click(
      within(view.headerTarget).getByRole('combobox', { name: 'Facts locale' })
    )
    const option = await view.findByRole('option', { name: 'ru' })
    fireEvent.click(option)
    await waitFor(() =>
      expect(option.hasAttribute('data-highlighted')).toBe(true)
    )
    fireEvent.click(option)

    expect(await view.findByText('Марат')).toBeTruthy()
    expect(new URLSearchParams(window.location.search).get('locale')).toBe('ru')
    expect(view.reads).toContain('catalogue:ru')
  })

  test('refreshes the active release while keeping its catalogue available', async () => {
    const view = renderFactsPage()
    await view.findByText('Marat')

    fireEvent.click(
      within(view.headerTarget).getByRole('button', { name: 'Refresh facts' })
    )

    await waitFor(() => {
      expect(view.reads.filter((read) => read === 'active')).toHaveLength(2)
    })
    expect(await view.findByText('Marat')).toBeTruthy()
  })

  test('loads catalogue data when refresh discovers a new active release', async () => {
    const view = renderFactsPage('/facts', [
      activeRelease,
      refreshedActiveRelease,
    ])
    await view.findByText('Marat')

    fireEvent.click(
      within(view.headerTarget).getByRole('button', { name: 'Refresh facts' })
    )

    await waitFor(() => {
      expect(view.container.textContent).toContain(refreshedReleaseId)
      expect(view.reads.filter((read) => read === 'active')).toHaveLength(2)
      expect(view.reads.filter((read) => read === 'catalogue:en')).toHaveLength(
        2
      )
    })
  })

  test('filters the catalogue from a URL-backed search input', async () => {
    const view = renderFactsPage()
    await view.findByText('Marat')

    fireEvent.change(view.getByRole('searchbox', { name: 'Search facts' }), {
      target: { value: 'integrity checks' },
    })

    await waitFor(() => {
      expect(view.queryByText('Marat')).toBeNull()
      expect(view.getByText('Example Company')).toBeTruthy()
    })
    expect(new URLSearchParams(window.location.search).get('q')).toBe(
      'integrity checks'
    )
  })

  test('falls back from an unavailable requested locale without issuing a bad read', async () => {
    const view = renderFactsPage('/facts?locale=de')

    expect(
      await view.findByText('Requested locale is unavailable')
    ).toBeTruthy()
    expect(await view.findByText('Marat')).toBeTruthy()
    expect(view.reads).toEqual(['active', 'catalogue:en'])
  })
})
