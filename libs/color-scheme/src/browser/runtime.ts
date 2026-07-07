import { bindColorSchemeControls } from '../dom'

const runtimeWindow = window as Window & {
  __cvColorSchemeRuntimeInstalled?: boolean
}

if (!runtimeWindow.__cvColorSchemeRuntimeInstalled) {
  runtimeWindow.__cvColorSchemeRuntimeInstalled = true
  bindColorSchemeControls()
}
