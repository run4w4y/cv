import {
  type ColorSchemePreference,
  type ColorSchemeStorage,
  colorSchemeChangeEvent,
  colorSchemeControlSelector,
  colorSchemeDataAttribute,
  colorSchemeValueAttribute,
  darkColorSchemeClassName,
  darkColorSchemeQuery,
  defaultColorSchemePreference,
  isColorSchemePreference,
  readColorSchemePreferenceFromStorage,
  resolveColorScheme,
  writeColorSchemePreferenceToStorage,
} from './core'

export type ColorSchemeRoot = {
  classList: Pick<DOMTokenList, 'toggle'>
  dataset: DOMStringMap
}

type ApplyColorSchemePreferenceOptions = {
  prefersDark?: boolean
  root?: ColorSchemeRoot
}

const noop: () => void = () => undefined
const colorSchemeSubscribers = new Set<() => void>()
let cleanupColorSchemeSubscription = noop

export const getColorSchemeStorage = (): ColorSchemeStorage | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }

  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export const readColorSchemePreference = (
  storage: ColorSchemeStorage | undefined = getColorSchemeStorage()
): ColorSchemePreference => readColorSchemePreferenceFromStorage(storage)

export const writeColorSchemePreference = (
  preference: ColorSchemePreference,
  storage: ColorSchemeStorage | undefined = getColorSchemeStorage()
) => {
  writeColorSchemePreferenceToStorage(preference, storage)
}

export const getPrefersDarkColorScheme = () => {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.matchMedia(darkColorSchemeQuery).matches
  } catch {
    return false
  }
}

export const resolveColorSchemePreference = (
  preference: ColorSchemePreference,
  prefersDark = getPrefersDarkColorScheme()
) => resolveColorScheme(preference, prefersDark)

export const getColorSchemeRoot = (): ColorSchemeRoot | undefined => {
  if (typeof document === 'undefined') {
    return undefined
  }

  return document.documentElement
}

export const applyColorSchemePreference = (
  preference: ColorSchemePreference,
  options: ApplyColorSchemePreferenceOptions = {}
) => {
  const root = options.root ?? getColorSchemeRoot()

  if (!root) {
    return
  }

  const resolvedColorScheme = resolveColorSchemePreference(
    preference,
    options.prefersDark
  )
  root.classList.toggle(
    darkColorSchemeClassName,
    resolvedColorScheme === 'dark'
  )
  root.dataset[colorSchemeDataAttribute] = preference
}

export const bootColorScheme = () => {
  applyColorSchemePreference(readColorSchemePreference())
}

export const getColorSchemeSnapshot = (): ColorSchemePreference => {
  const root = getColorSchemeRoot()
  const preference = root?.dataset[colorSchemeDataAttribute]

  return isColorSchemePreference(preference)
    ? preference
    : readColorSchemePreference()
}

export const getServerColorSchemeSnapshot = (): ColorSchemePreference =>
  defaultColorSchemePreference

export const syncColorSchemeControls = (
  preference: ColorSchemePreference = getColorSchemeSnapshot()
) => {
  if (typeof document === 'undefined') {
    return
  }

  document
    .querySelectorAll<Element>(colorSchemeControlSelector)
    .forEach((control) => {
      const active =
        control.getAttribute(colorSchemeValueAttribute) === preference
      control.setAttribute('aria-pressed', active ? 'true' : 'false')
      control.setAttribute('data-state', active ? 'on' : 'off')
    })
}

export const dispatchColorSchemeChange = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new Event(colorSchemeChangeEvent))
}

export const setColorSchemePreference = (preference: ColorSchemePreference) => {
  writeColorSchemePreference(preference)
  applyColorSchemePreference(preference)
  syncColorSchemeControls(preference)
  dispatchColorSchemeChange()
}

const getColorSchemeMediaQueryList = (): MediaQueryList | undefined => {
  if (typeof window === 'undefined') {
    return undefined
  }

  try {
    return window.matchMedia(darkColorSchemeQuery)
  } catch {
    return undefined
  }
}

const bindColorSchemeObservers = (onChange: () => void) => {
  if (typeof window === 'undefined') {
    return noop
  }

  const mediaQuery = getColorSchemeMediaQueryList()
  const handleColorSchemeChange = () => {
    applyColorSchemePreference(readColorSchemePreference())
    syncColorSchemeControls()
    onChange()
  }

  window.addEventListener(colorSchemeChangeEvent, handleColorSchemeChange)
  window.addEventListener('storage', handleColorSchemeChange)
  mediaQuery?.addEventListener('change', handleColorSchemeChange)

  return () => {
    window.removeEventListener(colorSchemeChangeEvent, handleColorSchemeChange)
    window.removeEventListener('storage', handleColorSchemeChange)
    mediaQuery?.removeEventListener('change', handleColorSchemeChange)
  }
}

export const subscribeToColorScheme = (onStoreChange: () => void) => {
  if (typeof window === 'undefined') {
    return noop
  }

  colorSchemeSubscribers.add(onStoreChange)

  if (colorSchemeSubscribers.size === 1) {
    cleanupColorSchemeSubscription = bindColorSchemeObservers(() => {
      colorSchemeSubscribers.forEach((subscriber) => {
        subscriber()
      })
    })
  }

  return () => {
    colorSchemeSubscribers.delete(onStoreChange)

    if (colorSchemeSubscribers.size === 0) {
      cleanupColorSchemeSubscription()
      cleanupColorSchemeSubscription = noop
    }
  }
}

export const bindColorSchemeControls = () => {
  if (typeof document === 'undefined') {
    return noop
  }

  const cleanupObservers = bindColorSchemeObservers(noop)
  const handleClick = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null
    const control = target?.closest(colorSchemeControlSelector)
    const preference = control?.getAttribute(colorSchemeValueAttribute)

    if (isColorSchemePreference(preference)) {
      setColorSchemePreference(preference)
    }
  }

  document.addEventListener('click', handleClick)
  syncColorSchemeControls()

  return () => {
    document.removeEventListener('click', handleClick)
    cleanupObservers()
  }
}
