import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import * as React from 'react'

import { Button } from './button'
import { Combobox } from './combobox'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from './dialog'

const options = [
  { value: 'applied', label: 'Applied' },
  { value: 'interviewing', label: 'Interviewing' },
] as const

afterEach(cleanup)

describe('overlay layer contract', () => {
  test('nests a floating portal above its parent dialog surface', async () => {
    const Harness = () => {
      const [value, setValue] = React.useState<string | null>(null)

      return (
        <Dialog defaultOpen>
          <DialogTrigger render={<Button>Open dialog</Button>} />
          <DialogContent>
            <DialogTitle>Layering dialog</DialogTitle>
            <Combobox
              ariaLabel="Layering status"
              value={value}
              onValueChange={setValue}
              options={options}
            />
          </DialogContent>
        </Dialog>
      )
    }

    render(<Harness />)
    fireEvent.click(screen.getByRole('combobox', { name: 'Layering status' }))
    await screen.findByRole('listbox')

    const dialogPortal = document.querySelector('[data-slot="dialog-portal"]')
    const dialogViewport = document.querySelector(
      '[data-slot="dialog-viewport"]'
    )
    const comboboxPortal = document.querySelector(
      '[data-slot="combobox-portal"]'
    )

    expect(dialogPortal).toBeTruthy()
    expect(comboboxPortal).toBeTruthy()
    expect(dialogPortal?.contains(comboboxPortal)).toBe(true)
    expect(dialogPortal?.className).toContain('z-(--z-modal)')
    expect(dialogViewport?.className).toContain('z-(--z-overlay-surface)')
    expect(comboboxPortal?.className).toContain('z-(--z-floating)')
  })
})
