'use client'

import { useSyncExternalStore } from 'react'
import {
  type ColorSchemePreference,
  getColorSchemeSnapshot,
  getServerColorSchemeSnapshot,
  isColorSchemePreference,
  setColorSchemePreference,
  subscribeToColorScheme,
} from './index'

export const useColorSchemePreference = () =>
  useSyncExternalStore(
    subscribeToColorScheme,
    getColorSchemeSnapshot,
    getServerColorSchemeSnapshot
  )

export {
  type ColorSchemePreference,
  isColorSchemePreference,
  setColorSchemePreference,
}
