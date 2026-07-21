import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { Button } from './button'
import {
  Stepper,
  StepperContent,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperList,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from './stepper'

const steps = [
  {
    step: 1,
    title: 'Add URLs',
    description: 'Paste and validate targets',
  },
  {
    step: 2,
    title: 'Configure',
    description: 'Choose output and locale',
  },
  {
    step: 3,
    title: 'Review',
    description: 'Confirm and launch',
  },
]

const Wizard = ({
  orientation = 'horizontal',
}: {
  readonly orientation?: 'horizontal' | 'vertical'
}) => {
  const [value, setValue] = useState(1)

  return (
    <Stepper
      value={value}
      onValueChange={setValue}
      orientation={orientation}
      className={orientation === 'horizontal' ? 'w-2xl' : 'w-md'}
    >
      <StepperList aria-label="Create workflow batch">
        {steps.map((item) => (
          <StepperItem key={item.step} step={item.step}>
            <StepperTrigger>
              <StepperIndicator />
              <StepperTitle>{item.title}</StepperTitle>
              <StepperDescription>{item.description}</StepperDescription>
            </StepperTrigger>
            <StepperSeparator />
          </StepperItem>
        ))}
      </StepperList>
      {steps.map((item) => (
        <StepperContent
          key={item.step}
          step={item.step}
          className="rounded-md border border-border bg-card p-5"
        >
          <p className="text-sm text-muted-foreground">
            {item.description}. This panel remains mounted while you move
            between steps.
          </p>
          <div className="mt-4 flex justify-between gap-2">
            <Button
              variant="outline"
              disabled={value === 1}
              onClick={() => setValue((current) => current - 1)}
            >
              Back
            </Button>
            <Button
              disabled={value === steps.length}
              onClick={() => setValue((current) => current + 1)}
            >
              Continue
            </Button>
          </div>
        </StepperContent>
      ))}
    </Stepper>
  )
}

const meta = {
  title: 'Navigation/Stepper',
  component: Stepper,
  tags: ['autodocs'],
} satisfies Meta<typeof Stepper>

export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {
  render: () => <Wizard />,
}

export const Vertical: Story = {
  render: () => <Wizard orientation="vertical" />,
}

export const ErrorState: Story = {
  render: () => (
    <Stepper value={2} className="w-2xl">
      <StepperList aria-label="Import progress">
        <StepperItem step={1}>
          <StepperTrigger>
            <StepperIndicator />
            <StepperTitle>Upload</StepperTitle>
            <StepperDescription>Source received</StepperDescription>
          </StepperTrigger>
          <StepperSeparator />
        </StepperItem>
        <StepperItem step={2} status="error">
          <StepperTrigger>
            <StepperIndicator />
            <StepperTitle>Validate</StepperTitle>
            <StepperDescription>One URL is invalid</StepperDescription>
          </StepperTrigger>
          <StepperSeparator />
        </StepperItem>
        <StepperItem step={3}>
          <StepperTrigger>
            <StepperIndicator />
            <StepperTitle>Launch</StepperTitle>
            <StepperDescription>Waiting for validation</StepperDescription>
          </StepperTrigger>
        </StepperItem>
      </StepperList>
    </Stepper>
  ),
}
