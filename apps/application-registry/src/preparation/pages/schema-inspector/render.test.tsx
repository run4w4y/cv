import { describe, expect, test } from 'bun:test'
import { inspectSchema } from '@cv/schema-editor/core'
import { render, screen } from '@testing-library/react'
import { Schema } from 'effect'

import { DescriptorTree } from './render'

describe('DescriptorTree', () => {
  test('renders an arbitrary inspected schema without a field registry', () => {
    const schema = Schema.Struct({
      dynamicallyNamedValue: Schema.String.annotate({
        title: 'Dynamic label',
      }),
    })

    render(
      <DescriptorTree
        descriptor={inspectSchema(schema).descriptor}
        name="Root"
      />
    )

    expect(screen.getByText('Root')).toBeTruthy()
    expect(screen.getByText('Dynamic label')).toBeTruthy()
  })
})
