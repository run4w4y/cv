import { describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { Tabs } from './tabs'
import { ToggleGroup } from './toggle-group'

describe('oriented UI wrappers', () => {
  test('forwards vertical orientation to the Base UI tabs root', () => {
    const element = Tabs({ orientation: 'vertical' }) as ReactElement<{
      orientation?: string
    }>

    expect(element.props.orientation).toBe('vertical')
  })

  test('forwards vertical orientation to the Base UI toggle-group root', () => {
    const element = ToggleGroup({
      children: null,
      orientation: 'vertical',
    }) as ReactElement<{ orientation?: string }>

    expect(element.props.orientation).toBe('vertical')
  })
})
