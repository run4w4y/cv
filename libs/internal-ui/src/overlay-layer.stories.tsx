import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './alert-dialog'
import { Button } from './button'
import { Combobox } from './combobox'
import { DateTimeInput } from './date-time-input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { Field, FieldLabel } from './field'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Select } from './select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './sheet'

const options = [
  { value: 'applied', label: 'Applied' },
  { value: 'interviewing', label: 'Interviewing' },
  { value: 'offer', label: 'Offer' },
] as const

const NestedOverlayMatrix = () => {
  const [status, setStatus] = React.useState<string | null>(null)
  const [priority, setPriority] = React.useState<string | null>(null)
  const [scheduledAt, setScheduledAt] = React.useState<Date | null>(null)
  const [sheetStatus, setSheetStatus] = React.useState<string | null>(null)

  return (
    <div className="flex flex-wrap gap-2">
      <Dialog>
        <DialogTrigger render={<Button>Open layering dialog</Button>} />
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nested overlay matrix</DialogTitle>
            <DialogDescription>
              Every floating surface must stay interactive above this dialog.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Field>
              <FieldLabel>Status combobox</FieldLabel>
              <Combobox
                ariaLabel="Layering status"
                value={status}
                onValueChange={setStatus}
                options={options}
              />
            </Field>

            <Field>
              <FieldLabel>Priority select</FieldLabel>
              <Select
                ariaLabel="Layering priority"
                value={priority}
                onValueChange={setPriority}
                options={[
                  { value: 'normal', label: 'Normal' },
                  { value: 'high', label: 'High' },
                ]}
              />
            </Field>

            <Field>
              <FieldLabel>Scheduled at</FieldLabel>
              <DateTimeInput
                ariaLabel="Layering calendar"
                value={scheduledAt}
                onChange={(value) => setScheduledAt(value ?? null)}
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              <Popover>
                <PopoverTrigger
                  render={<Button variant="outline">Help</Button>}
                />
                <PopoverContent>Nested popover content</PopoverContent>
              </Popover>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline">Open actions</Button>}
                />
                <DropdownMenuContent>
                  <DropdownMenuItem>Duplicate</DropdownMenuItem>
                  <DropdownMenuItem>Archive</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button variant="outline">Open confirmation</Button>}
                />
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm nested action</AlertDialogTitle>
                    <AlertDialogDescription>
                      A nested modal must render above its parent dialog.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction>Confirm</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet>
        <SheetTrigger
          render={<Button variant="outline">Open layering sheet</Button>}
        />
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Nested sheet overlay</SheetTitle>
            <SheetDescription>
              Floating controls must remain interactive inside a sheet.
            </SheetDescription>
          </SheetHeader>
          <Combobox
            ariaLabel="Sheet status"
            value={sheetStatus}
            onValueChange={setSheetStatus}
            options={options}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}

const meta = {
  title: 'Overlays/Layering',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

export const NestedOverlays: Story = {
  render: () => <NestedOverlayMatrix />,
}
