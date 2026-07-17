import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render } from '@testing-library/react'

import { SidebarInset, SidebarProvider } from './sidebar'

afterEach(cleanup)

describe('SidebarProvider', () => {
  test('bounds the application shell to one scroll-manageable viewport', () => {
    const view = render(
      <SidebarProvider>
        <SidebarInset>Content</SidebarInset>
      </SidebarProvider>
    )

    const provider = view.container.querySelector(
      '[data-slot="sidebar-provider"]'
    )
    const inset = view.container.querySelector('[data-slot="sidebar-inset"]')

    expect(provider?.classList.contains('h-dvh')).toBe(true)
    expect(provider?.classList.contains('overflow-hidden')).toBe(true)
    expect(inset?.classList.contains('h-full')).toBe(true)
    expect(inset?.classList.contains('min-h-0')).toBe(true)
  })
})
