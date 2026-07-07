import {
  type ColorSchemePreference,
  isColorSchemePreference,
  setColorSchemePreference,
  useColorSchemePreference,
} from '@cv/color-scheme/react'
import { ToggleGroup, ToggleGroupItem } from '@cv/ui/toggle-group'
import { Monitor, Moon, Sun } from 'lucide-react'

type ColorSchemeLabels = Record<string, string>
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

  const handleValueChange = (value: string[]) => {
    const nextPreference = value.at(0)

    if (isColorSchemePreference(nextPreference)) {
      setColorSchemePreference(nextPreference)
    }
  }

  return (
    <ToggleGroup
      aria-label={labels.theme}
      className="font-mono"
      data-cv-color-scheme-toggle
      onValueChange={handleValueChange}
      size="toolbar"
      value={[colorSchemePreference]}
      variant="toolbar"
    >
      {getColorSchemeOptions(labels).map((item) => {
        const Icon = item.icon

        return (
          <ToggleGroupItem
            aria-label={item.label}
            className="!rounded-none"
            data-cv-color-scheme-value={item.value}
            key={item.value}
            value={item.value}
          >
            <Icon data-icon="inline-start" />
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
}
