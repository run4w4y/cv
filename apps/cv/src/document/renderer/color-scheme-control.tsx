'use client'

import {
  type ColorSchemePreference,
  setColorSchemePreference,
  useColorSchemePreference,
} from '@cv/color-scheme/react'

import type { CvRendererLabels } from './labels'

const preferences = [
  'light',
  'dark',
  'system',
] as const satisfies readonly ColorSchemePreference[]

export const ColorSchemeControl = ({
  labels,
}: {
  readonly labels: CvRendererLabels
}) => {
  const preference = useColorSchemePreference()
  const labelByPreference = {
    dark: labels.darkColorScheme,
    light: labels.lightColorScheme,
    system: labels.systemColorScheme,
  } satisfies Record<ColorSchemePreference, string>

  return (
    <fieldset className="cv2-color-scheme-control">
      <legend className="cv2-visually-hidden">{labels.colorScheme}</legend>
      {preferences.map((value) => (
        <button
          aria-pressed={preference === value}
          className="cv2-color-scheme-option"
          data-cv-color-scheme-value={value}
          key={value}
          onClick={() => setColorSchemePreference(value)}
          type="button"
        >
          {labelByPreference[value]}
        </button>
      ))}
    </fieldset>
  )
}
