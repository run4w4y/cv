export const defaultColorSchemePreference = 'system'
export const darkColorSchemeClassName = 'dark'
export const darkColorSchemeQuery = '(prefers-color-scheme: dark)'
export const legacyThemeStorageKey = 'theme'
export const legacyVersionedThemeStorageKey = 'cv:theme:v1'
export const colorSchemeChangeEvent = 'cv-color-scheme-change'
export const colorSchemeControlSelector = '[data-cv-color-scheme-value]'
export const colorSchemeDataAttribute = 'colorScheme'
export const colorSchemeStorageKey = 'cv:color-scheme:v1'
export const colorSchemeValueAttribute = 'data-cv-color-scheme-value'

export const colorSchemePreferences = ['light', 'dark', 'system'] as const
export const legacyColorSchemeStorageKeys = [
  legacyVersionedThemeStorageKey,
  legacyThemeStorageKey,
] as const

export type ColorSchemePreference = (typeof colorSchemePreferences)[number]
export type ResolvedColorScheme = Exclude<ColorSchemePreference, 'system'>
export type ColorSchemeStorage = Pick<
  Storage,
  'getItem' | 'removeItem' | 'setItem'
>

export const isColorSchemePreference = (
  preference: unknown
): preference is ColorSchemePreference =>
  preference === 'light' || preference === 'dark' || preference === 'system'

export const safelyReadStorage = (
  storage: ColorSchemeStorage | undefined,
  key: string
): string | null => {
  if (!storage) {
    return null
  }

  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

export const safelyWriteStorage = (
  storage: ColorSchemeStorage | undefined,
  key: string,
  value: string
) => {
  if (!storage) {
    return
  }

  try {
    storage.setItem(key, value)
  } catch {
    return
  }
}

export const safelyRemoveStorage = (
  storage: ColorSchemeStorage | undefined,
  key: string
) => {
  if (!storage) {
    return
  }

  try {
    storage.removeItem(key)
  } catch {
    return
  }
}

export const readColorSchemePreferenceFromStorage = (
  storage: ColorSchemeStorage | undefined
): ColorSchemePreference => {
  const storedPreference = safelyReadStorage(storage, colorSchemeStorageKey)

  if (isColorSchemePreference(storedPreference)) {
    return storedPreference
  }

  for (const legacyKey of legacyColorSchemeStorageKeys) {
    const legacyPreference = safelyReadStorage(storage, legacyKey)

    if (isColorSchemePreference(legacyPreference)) {
      safelyWriteStorage(storage, colorSchemeStorageKey, legacyPreference)
      legacyColorSchemeStorageKeys.forEach((key) => {
        safelyRemoveStorage(storage, key)
      })
      return legacyPreference
    }
  }

  return defaultColorSchemePreference
}

export const writeColorSchemePreferenceToStorage = (
  preference: ColorSchemePreference,
  storage: ColorSchemeStorage | undefined
) => {
  safelyWriteStorage(storage, colorSchemeStorageKey, preference)
  legacyColorSchemeStorageKeys.forEach((key) => {
    safelyRemoveStorage(storage, key)
  })
}

export const resolveColorScheme = (
  preference: ColorSchemePreference,
  prefersDark: boolean
): ResolvedColorScheme => {
  if (preference === 'dark' || (preference === 'system' && prefersDark)) {
    return 'dark'
  }

  return 'light'
}
