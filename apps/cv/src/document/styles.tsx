import type { ComponentPropsWithoutRef } from 'react'

export const cvRendererStyles = `
:where([data-cv-document]) {
  --cv2-accent: #155eef;
  --cv2-accent-soft: #eff6ff;
  --cv2-border: #d8dee9;
  --cv2-muted: #536070;
  --cv2-paper: #ffffff;
  --cv2-text: #111827;
  box-sizing: border-box;
  width: min(100%, 210mm);
  min-height: min(297mm, 100dvh);
  margin-inline: auto;
  padding: clamp(1.25rem, 3.5vw, 3rem);
  overflow-wrap: anywhere;
  color: var(--cv2-text);
  background: var(--cv2-paper);
  box-shadow: 0 1.2rem 3.5rem rgb(15 23 42 / 12%);
  font-family:
    Geist, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
    "Segoe UI", sans-serif;
  font-size: 0.925rem;
  line-height: 1.5;
  text-rendering: geometricPrecision;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

:where([data-cv-document]),
:where([data-cv-document]) *,
:where([data-cv-document]) *::before,
:where([data-cv-document]) *::after {
  box-sizing: border-box;
}

:where([data-cv-document]) :where(h1, h2, h3, p, ul, dl, dd, figure) {
  margin: 0;
}

:where([data-cv-document]) :where(ul) {
  padding: 0;
}

.cv2-visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.cv2-header {
  display: grid;
  gap: 0.85rem;
  padding-block-end: 1rem;
  border-block-end: 1px solid var(--cv2-border);
}

.cv2-name {
  max-width: 22ch;
  font-size: clamp(2rem, 5vw, 3.3rem);
  font-weight: 760;
  line-height: 0.98;
  letter-spacing: -0.045em;
}

.cv2-headline {
  color: var(--cv2-accent);
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.25;
}

.cv2-location {
  color: var(--cv2-muted);
  font-size: 0.82rem;
}

.cv2-contacts {
  font-style: normal;
}

.cv2-contact-list,
.cv2-inline-list,
.cv2-link-list,
.cv2-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.75rem;
  list-style: none;
}

.cv2-contact-item {
  display: inline-flex;
  gap: 0.35rem;
  align-items: baseline;
  min-width: 0;
  font-size: 0.78rem;
}

.cv2-contact-label {
  color: var(--cv2-muted);
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.055em;
  text-transform: uppercase;
}

:where([data-cv-document]) a {
  color: inherit;
  text-decoration-color: color-mix(in srgb, var(--cv2-accent) 50%, transparent);
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.16em;
}

:where([data-cv-document]) a:hover {
  color: var(--cv2-accent);
}

.cv2-summary {
  max-width: 84ch;
  margin-block-start: 1rem;
  color: #273244;
  font-size: 0.92rem;
}

.cv2-layout {
  display: grid;
  gap: 1.5rem 2rem;
  margin-block-start: 1.5rem;
}

.cv2-column {
  display: grid;
  align-content: start;
  gap: 1.45rem;
  min-width: 0;
}

.cv2-section {
  min-width: 0;
}

.cv2-section-heading {
  display: flex;
  gap: 0.65rem;
  align-items: center;
  margin-block-end: 0.75rem;
  color: var(--cv2-accent);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  line-height: 1.2;
  text-transform: uppercase;
}

.cv2-section-heading::after {
  height: 1px;
  flex: 1;
  background: var(--cv2-border);
  content: "";
}

.cv2-entry-list {
  display: grid;
  gap: 1rem;
  list-style: none;
}

.cv2-entry,
.cv2-skill-group,
.cv2-additional-item {
  break-inside: avoid;
}

.cv2-entry-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.2rem 0.8rem;
  align-items: baseline;
}

.cv2-entry-title {
  font-size: 0.98rem;
  font-weight: 760;
  line-height: 1.2;
}

.cv2-entry-organization {
  margin-block-start: 0.08rem;
  color: var(--cv2-accent);
  font-size: 0.78rem;
  font-weight: 690;
}

.cv2-entry-period {
  grid-row: 1 / span 2;
  grid-column: 2;
  color: var(--cv2-muted);
  font-size: 0.7rem;
  text-align: end;
  white-space: nowrap;
}

.cv2-entry-location {
  display: block;
  white-space: normal;
}

.cv2-entry-summary {
  margin-block-start: 0.45rem;
  color: #364153;
  font-size: 0.8rem;
}

.cv2-highlights {
  display: grid;
  gap: 0.28rem;
  margin-block-start: 0.5rem;
  padding-inline-start: 1.05rem;
}

.cv2-highlight {
  padding-inline-start: 0.12rem;
  color: #273244;
  font-size: 0.78rem;
}

.cv2-highlight::marker {
  color: var(--cv2-accent);
}

.cv2-chip-list {
  gap: 0.28rem;
  margin-block-start: 0.55rem;
}

.cv2-chip {
  padding: 0.13rem 0.42rem;
  border: 1px solid #c9d8f7;
  border-radius: 999px;
  color: #24406f;
  background: var(--cv2-accent-soft);
  font-size: 0.62rem;
  font-weight: 650;
  line-height: 1.35;
}

.cv2-link-list {
  gap: 0.25rem 0.7rem;
  margin-block-start: 0.45rem;
  font-size: 0.7rem;
}

.cv2-skill-list,
.cv2-additional-list {
  display: grid;
  gap: 0.7rem;
  list-style: none;
}

.cv2-skill-label,
.cv2-additional-title {
  color: #273244;
  font-size: 0.74rem;
  font-weight: 760;
}

.cv2-skill-items,
.cv2-additional-text {
  margin-block-start: 0.18rem;
  color: var(--cv2-muted);
  font-size: 0.72rem;
}

.cv2-publication {
  display: none;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.75rem;
  align-items: center;
  margin-block-start: 1rem;
  padding-block-start: 0.7rem;
  border-block-start: 1px solid var(--cv2-border);
  break-inside: avoid;
}

.cv2-publication-link {
  display: block;
  color: inherit;
  text-decoration: none;
}

.cv2-qr {
  width: 22mm;
  height: 22mm;
  color: #000000;
  background: #ffffff;
}

.cv2-publication-label {
  color: var(--cv2-accent);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.cv2-publication-instructions,
.cv2-publication-url {
  display: block;
  margin-block-start: 0.12rem;
  color: var(--cv2-muted);
  font-size: 0.6rem;
  line-height: 1.25;
}

.cv2-publication-url {
  color: #273244;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

@media (min-width: 52rem) {
  .cv2-layout {
    grid-template-columns: minmax(0, 1.75fr) minmax(12rem, 0.8fr);
  }
}

:where([data-cv-document][data-cv-renderer-mode="print-preview"]) {
  width: 210mm;
  min-height: 297mm;
  padding: 10mm 11mm;
  font-size: 8.2pt;
  line-height: 1.32;
}

:where([data-cv-document][data-cv-renderer-mode="print-preview"])
  .cv2-layout {
  grid-template-columns: minmax(0, 1.75fr) minmax(42mm, 0.8fr);
}

:where([data-cv-document][data-cv-renderer-mode="print-preview"])
  .cv2-publication {
  display: grid;
}

@page {
  size: A4;
  margin: 0;
}

@media print {
  :where([data-cv-document]) {
    width: 210mm;
    min-height: 297mm;
    margin: 0;
    padding: 10mm 11mm;
    box-shadow: none;
    font-size: 8.2pt;
    line-height: 1.32;
  }

  :where([data-cv-document]) .cv2-layout {
    grid-template-columns: minmax(0, 1.75fr) minmax(42mm, 0.8fr);
  }

  :where([data-cv-document]) .cv2-publication {
    display: grid;
  }
}
`

export type CvRendererStyleSheetProps = Pick<
  ComponentPropsWithoutRef<'style'>,
  'nonce'
>

export const CvRendererStyleSheet = ({ nonce }: CvRendererStyleSheetProps) => (
  <style data-cv-renderer-styles nonce={nonce}>
    {cvRendererStyles}
  </style>
)
