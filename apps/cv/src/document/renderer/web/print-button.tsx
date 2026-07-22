'use client'

export const WebPrintButton = ({ label }: { readonly label: string }) => (
  <button
    className="cv-web-print-button"
    onClick={() => window.print()}
    type="button"
  >
    {label}
    <span aria-hidden="true">↗</span>
  </button>
)
