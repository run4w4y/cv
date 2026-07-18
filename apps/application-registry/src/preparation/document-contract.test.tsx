import { describe, expect, test } from 'bun:test'
import { inspectSchema } from '@cv/schema-editor/core'
import { render, screen } from '@testing-library/react'
import { Schema } from 'effect'

import { collectSchemaGuidance } from './document-contract'
import { DescriptorTree } from './pages/schema-inspector/render'

describe('schema-generic management tooling', () => {
  test('collects guidance from arbitrary property names by JSON pointer', () => {
    const items = collectSchemaGuidance({
      type: 'object',
      properties: {
        neverHardCodedByTheUi: {
          type: 'string',
          generationGuidance: {
            instruction: 'Use the supplied source.',
            sources: ['trusted-facts'],
          },
        },
      },
    })

    expect(items).toEqual([
      {
        instruction: 'Use the supplied source.',
        maxWords: null,
        pointer: '/neverHardCodedByTheUi',
        sources: ['trusted-facts'],
        title: null,
      },
    ])
  })

  test('renders an arbitrary inspected schema without a field registry', () => {
    const schema = Schema.Struct({
      dynamicallyNamedValue: Schema.String.annotate({
        title: 'Dynamic label',
      }),
    })
    render(<DescriptorTree descriptor={inspectSchema(schema).descriptor} />)

    expect(screen.getByText('Dynamic label')).toBeTruthy()
    expect(screen.getByText('string')).toBeTruthy()
  })
})
