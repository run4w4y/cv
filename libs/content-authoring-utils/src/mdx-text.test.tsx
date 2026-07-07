import { describe, expect, test } from 'bun:test'
import { isValidElement, type ReactNode } from 'react'
import {
  collectListItemTexts,
  elementChildren,
  groupChildrenByHeading,
  splitChildrenAtFirstHeading,
  textFromChildren,
} from './mdx-text'

const Ignored = ({ children }: { children?: ReactNode }) => <>{children}</>

describe('mdx text helpers', () => {
  test('extracts normalized text while allowing ignored subtrees', () => {
    const children = (
      <p>
        Build <strong>content</strong>
        <Ignored>private copy</Ignored>
      </p>
    )

    expect(
      textFromChildren(children, {
        ignore: (node) => isValidElement(node) && node.type === Ignored,
      })
    ).toBe('Build content')
  })

  test('collects list item text without descending into collected items', () => {
    const children = (
      <ul>
        <li>
          First <strong>highlight</strong>
        </li>
        <li>
          Second
          <ul>
            <li>Nested detail</li>
          </ul>
        </li>
      </ul>
    )

    expect(collectListItemTexts(children)).toEqual([
      'First highlight',
      'Second Nested detail',
    ])
  })

  test('splits children at the first heading', () => {
    const { body, heading } = splitChildrenAtFirstHeading(
      <>
        <p>Intro text</p>
        <h2>Thesis</h2>
        <p>Body text</p>
      </>
    )

    expect(
      heading && isValidElement(heading)
        ? textFromChildren(elementChildren(heading))
        : ''
    ).toBe('Thesis')
    expect(textFromChildren(body)).toBe('Body text')
  })

  test('groups children by repeated heading level', () => {
    const sections = groupChildrenByHeading(
      <>
        <h3>Discovery</h3>
        <p>Map the system.</p>
        <h4>Nested note</h4>
        <p>Keep with discovery.</p>
        <h3>Delivery</h3>
        <p>Ship the work.</p>
      </>
    )

    expect(
      sections.map((section) => ({
        body: textFromChildren(section.body),
        level: section.level,
        title: section.title,
      }))
    ).toEqual([
      {
        body: 'Map the system. Nested note Keep with discovery.',
        level: 3,
        title: 'Discovery',
      },
      {
        body: 'Ship the work.',
        level: 3,
        title: 'Delivery',
      },
    ])
  })
})
