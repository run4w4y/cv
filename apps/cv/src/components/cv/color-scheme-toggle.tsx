import {
  type ColorSchemePreference,
  setColorSchemePreference,
  useColorSchemePreference,
} from '@cv/color-scheme/react'
import { toggleVariants } from '@cv/ui/toggle'
import { cn } from '@cv/ui/utils'
import { Monitor, Moon, Sun } from 'lucide-react'

type ColorSchemeLabels = {
  theme: string
  themeDark: string
  themeLight: string
  themeSystem: string
}
type ColorSchemeToggleProps = {
  labels: ColorSchemeLabels
}

const getColorSchemeOptions = (
  labels: ColorSchemeLabels
): Array<{
  icon: typeof Sun
  label: string
  value: ColorSchemePreference
}> => [
  { icon: Sun, label: labels.themeLight, value: 'light' },
  { icon: Moon, label: labels.themeDark, value: 'dark' },
  { icon: Monitor, label: labels.themeSystem, value: 'system' },
]

export const ColorSchemeToggle = ({ labels }: ColorSchemeToggleProps) => {
  const colorSchemePreference = useColorSchemePreference()

  return (
    <fieldset
      className="m-0 inline-flex items-center border-0 p-0 font-mono"
      data-cv-color-scheme-toggle
    >
      <legend className="sr-only">{labels.theme}</legend>
      {getColorSchemeOptions(labels).map((item) => {
        const Icon = item.icon
        const active = colorSchemePreference === item.value

        return (
          <button
            aria-label={item.label}
            aria-pressed={active}
            className={cn(
              toggleVariants({ size: 'toolbar', variant: 'toolbar' }),
              '-ml-px first:ml-0'
            )}
            data-cv-color-scheme-value={item.value}
            data-state={active ? 'on' : 'off'}
            key={item.value}
            onClick={() => setColorSchemePreference(item.value)}
            type="button"
          >
            <Icon data-icon="inline-start" />
          </button>
        )
      })}
    </fieldset>
  )
}
