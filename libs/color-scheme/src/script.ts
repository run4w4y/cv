import {
  colorSchemeDataAttribute,
  colorSchemePreferences,
  colorSchemeStorageKey,
  darkColorSchemeClassName,
  darkColorSchemeQuery,
  defaultColorSchemePreference,
  legacyColorSchemeStorageKeys,
} from './core'

const json = (value: unknown) => JSON.stringify(value)

/**
 * Creates the tiny synchronous bootstrap used before first paint. Keeping the
 * source here lets SSR frameworks use the same storage contract without a
 * Node.js filesystem dependency.
 */
export const createColorSchemeBootScript = () =>
  `(()=>{let p=${json(defaultColorSchemePreference)};try{const s=window.localStorage,k=${json(colorSchemeStorageKey)},v=s.getItem(k),a=${json(colorSchemePreferences)},l=${json(legacyColorSchemeStorageKeys)};if(a.includes(v)){p=v}else{for(const k of l){const v=s.getItem(k);if(a.includes(v)){p=v;s.setItem(${json(colorSchemeStorageKey)},v);l.forEach(k=>s.removeItem(k));break}}}}catch{}const r=document.documentElement,d=p===${json('dark')}||p===${json('system')}&&window.matchMedia(${json(darkColorSchemeQuery)}).matches;r.classList.toggle(${json(darkColorSchemeClassName)},d);r.dataset[${json(colorSchemeDataAttribute)}]=p})()`
