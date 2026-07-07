import QRCode from 'qrcode'

const qrOptions = {
  color: {
    dark: '#000000',
    light: '#ffffff',
  },
  errorCorrectionLevel: 'M',
  margin: 1,
  type: 'image/png',
  width: 1024,
} as const

const qrSelector = 'img[data-print-qr-image]'
const qrUrlAttribute = 'data-print-qr-url'
const qrRenderedUrlAttribute = 'data-print-qr-rendered-url'

const isLoadedImage = (image: HTMLImageElement) =>
  image.complete && image.naturalWidth > 0 && image.naturalHeight > 0

const markQrReady = (image: HTMLImageElement, url: string) => {
  image.setAttribute(qrRenderedUrlAttribute, url)
  image.setAttribute('data-print-qr-ready', 'true')

  if (
    image.hasAttribute('data-private-qr-image') &&
    image.hasAttribute('data-private-qr-unlocked')
  ) {
    image.setAttribute('data-private-qr-ready', 'true')
  } else {
    image.removeAttribute('data-private-qr-ready')
  }
}

const loadImageSource = (image: HTMLImageElement, src: string) =>
  new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Print QR image failed to load'))
    image.src = src

    if (isLoadedImage(image)) {
      resolve()
    }
  })

const renderPrintQrImage = async (image: HTMLImageElement) => {
  const url = image.getAttribute(qrUrlAttribute)

  if (!url) {
    return
  }

  if (
    image.getAttribute(qrRenderedUrlAttribute) === url &&
    isLoadedImage(image)
  ) {
    markQrReady(image, url)
    return
  }

  image.removeAttribute('data-print-qr-ready')
  image.removeAttribute('data-private-qr-ready')

  const src = await QRCode.toDataURL(url, qrOptions)

  if (image.getAttribute(qrUrlAttribute) !== url) {
    return
  }

  await loadImageSource(image, src)

  if (image.getAttribute(qrUrlAttribute) === url) {
    markQrReady(image, url)
  }
}

const renderPrintQrImages = () => {
  document.querySelectorAll<HTMLImageElement>(qrSelector).forEach((image) => {
    renderPrintQrImage(image).catch((cause: unknown) => {
      console.error('Could not generate print QR code', cause)
    })
  })
}

const bindPrintQrCodes = () => {
  let scheduled = false
  const scheduleRender = () => {
    if (scheduled) {
      return
    }

    scheduled = true
    window.requestAnimationFrame(() => {
      scheduled = false
      renderPrintQrImages()
    })
  }

  const observer = new MutationObserver(scheduleRender)

  observer.observe(document.documentElement, {
    attributeFilter: [qrUrlAttribute, 'data-private-qr-unlocked'],
    attributes: true,
    childList: true,
    subtree: true,
  })
  scheduleRender()
}

export const bindPrintControls = () => {
  bindPrintQrCodes()

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null
    const button = target?.closest('[data-print-button]')

    if (button) {
      window.print()
    }
  })
}
