const fallbackEmail = 'access@run4w4y.dev'

export const fullAccessEmail =
  import.meta.env.PUBLIC_CV_FULL_ACCESS_EMAIL?.trim() || fallbackEmail

export const fullAccessMailto = `mailto:${fullAccessEmail}`
