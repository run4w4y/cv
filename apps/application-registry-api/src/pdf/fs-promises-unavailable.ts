const unavailable = (): never => {
  throw new Error(
    'Node filesystem APIs are unavailable in the Cloudflare Browser Rendering worker.'
  )
}

export const mkdtemp = unavailable
export const rename = unavailable
export const rm = unavailable
export const unlink = unavailable
