import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { CvAuthoringSource } from '@cv/application-preparation-workflow'
import { TooltipProvider } from '@cv/internal-ui'
import { cleanup, fireEvent, render } from '@testing-library/react'

import { CvDocumentEditor } from './cv-editor'
import { documentWorkspaceCvFixture } from './story-fixtures'
import type { DocumentPath } from './types'

afterEach(cleanup)

const reviewed = {
  additionalSectionItems: [
    {
      context: ['Languages'],
      details: [],
      id: 'language.fr',
      kind: 'language',
      label: 'French — conversational',
      sectionTitle: 'Languages',
    },
  ],
  education: [
    {
      degree: 'M.Sc. Computer Science',
      evidenceIds: ['education.eth'],
      id: 'education.eth',
      institution: 'ETH Zürich',
      period: '2016–2018',
    },
  ],
  experience: [
    {
      company: 'Orbit',
      evidenceIds: ['experience.orbit'],
      id: 'experience.orbit',
      period: '2016–2018',
      roles: ['Software Engineer'],
      technologies: ['TypeScript'],
    },
  ],
  person: {
    contacts: [],
    locations: ['Berlin, Germany'],
    names: ['Ada Example'],
  },
  projects: [
    {
      evidenceIds: ['project.compiler'],
      id: 'project.compiler',
      links: [],
      name: 'Schema compiler',
      technologies: ['Effect'],
    },
  ],
  references: [],
  skillGroups: [
    {
      evidenceIds: ['skills.delivery'],
      id: 'skills.delivery',
      items: ['Continuous delivery'],
      label: 'Delivery',
    },
  ],
} satisfies CvAuthoringSource

describe('CvDocumentEditor', () => {
  test('emits focused tuple-path edits instead of a whole document', () => {
    const onEdit = mock(() => undefined)
    const view = render(
      <TooltipProvider delay={0}>
        <CvDocumentEditor
          document={documentWorkspaceCvFixture}
          issues={[]}
          mutations={{ onEdit }}
        />
      </TooltipProvider>
    )

    fireEvent.change(view.getByLabelText('Headline'), {
      target: { value: 'Principal platform engineer' },
    })

    expect(onEdit).toHaveBeenCalledWith(
      ['person', 'headline'],
      'Principal platform engineer'
    )
    expect(view.queryByLabelText('Name')).toBeNull()
    expect(
      view.getByText('Name: reviewed fact.', { exact: false })
    ).toBeTruthy()
  })

  test('uses one compact drag-and-drop row pattern for ordered sections', () => {
    const onRemove = mock(() => undefined)
    const view = render(
      <TooltipProvider delay={0}>
        <CvDocumentEditor
          document={documentWorkspaceCvFixture}
          issues={[]}
          mutations={{
            onEdit: () => undefined,
            onRemove,
          }}
        />
      </TooltipProvider>
    )

    const firstExperience = documentWorkspaceCvFixture.experience[0]
    if (firstExperience === undefined) {
      throw new Error('The editor fixture must include an experience entry')
    }

    fireEvent.click(
      view.getByRole('button', {
        name: `Remove ${firstExperience.role} at ${firstExperience.company}`,
      })
    )

    expect(view.getByRole('grid', { name: 'Reorder experience' })).toBeTruthy()
    expect(
      view.getByRole('button', {
        name: `Drag ${firstExperience.role} at ${firstExperience.company}`,
      })
    ).toBeTruthy()
    expect(view.queryByRole('button', { name: /Move /u })).toBeNull()
    expect(onRemove).toHaveBeenCalledWith(['experience'], 0)
  })

  test('adds top-level sections only from reviewed facts', () => {
    const onAdd = mock(
      (_path: DocumentPath, _value: unknown, _index?: number) => undefined
    )
    const emptyDocument = {
      ...documentWorkspaceCvFixture,
      additionalSections: [],
      education: [],
      experience: [],
      projects: [],
      skills: [],
    }
    const view = render(
      <TooltipProvider delay={0}>
        <CvDocumentEditor
          document={emptyDocument}
          issues={[]}
          mutations={{ onAdd, onEdit: () => undefined }}
          reviewed={reviewed}
        />
      </TooltipProvider>
    )

    for (const [label, option] of [
      ['Add reviewed experience', 'Software Engineer · Orbit'],
      ['Add reviewed project', 'Schema compiler'],
      ['Add reviewed skill group', 'Delivery'],
      ['Add reviewed education', 'M.Sc. Computer Science · ETH Zürich'],
      ['Add reviewed detail', 'French — conversational'],
    ] as const) {
      fireEvent.click(view.getByRole('combobox', { name: label }))
      fireEvent.click(view.getByRole('option', { name: option }))
    }

    expect(onAdd).toHaveBeenCalledTimes(5)
    const additions = onAdd.mock.calls.map(([path, value]) => ({
      path,
      value: value as { readonly id: string },
    }))
    expect(additions.map(({ path }) => path)).toEqual([
      ['experience'],
      ['projects'],
      ['skills'],
      ['education'],
      ['additionalSections'],
    ])
    expect(additions.slice(0, 4).map(({ value }) => value.id)).toEqual([
      'experience.orbit',
      'project.compiler',
      'skills.delivery',
      'education.eth',
    ])
    expect(additions[0]?.value).toMatchObject({
      technologies: ['TypeScript'],
    })
    expect(additions[1]?.value).toMatchObject({
      links: [],
      technologies: ['Effect'],
    })
    expect(additions[2]?.value).toMatchObject({
      items: ['Continuous delivery'],
    })
    expect(additions[4]?.value.id).toMatch(/^section:[a-f0-9-]+$/u)
    expect(additions[4]?.value).toMatchObject({
      title: 'Languages',
    })
    expect(additions[4]?.value).toMatchObject({
      items: [{ id: 'language.fr' }],
    })
  })

  test('can add the first education detail and restore an empty custom section', () => {
    const onAdd = mock(
      (_path: DocumentPath, _value: unknown, _index?: number) => undefined
    )
    const document = {
      ...documentWorkspaceCvFixture,
      additionalSections: [
        {
          ...documentWorkspaceCvFixture.additionalSections[0],
          items: [],
        },
      ],
      education: [
        {
          ...documentWorkspaceCvFixture.education[0],
          details: [],
        },
      ],
    }
    const view = render(
      <TooltipProvider delay={0}>
        <CvDocumentEditor
          document={document}
          issues={[]}
          mutations={{ onAdd, onEdit: () => undefined }}
          reviewed={reviewed}
        />
      </TooltipProvider>
    )

    fireEvent.click(view.getByRole('button', { name: 'Add detail' }))
    fireEvent.click(
      view.getByRole('combobox', {
        name: 'Add reviewed item to Languages',
      })
    )
    fireEvent.click(
      view.getByRole('option', { name: 'French — conversational' })
    )

    expect(onAdd).toHaveBeenNthCalledWith(1, ['education', 0, 'details'], '', 0)
    expect(onAdd.mock.calls[1]?.[0]).toEqual(['additionalSections', 0, 'items'])
    expect(onAdd.mock.calls[1]?.[1]).toMatchObject({ id: 'language.fr' })
  })
})
