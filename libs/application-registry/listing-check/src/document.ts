import { Option, Schema } from 'effect'
import { DomUtils, parseDocument } from 'htmlparser2'

const UnknownRecordSchema = Schema.Record(Schema.String, Schema.Unknown)
const JsonLdJobPostingSchema = Schema.Struct({
  '@type': Schema.Union([Schema.String, Schema.Array(Schema.String)]),
  hiringOrganization: Schema.optional(
    Schema.Struct({ name: Schema.optional(Schema.String) })
  ),
  title: Schema.optional(Schema.String),
  validThrough: Schema.optional(Schema.String),
})

const decodeJson = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)
const decodeRecord = Schema.decodeUnknownOption(UnknownRecordSchema)
const decodeJobPosting = Schema.decodeUnknownOption(JsonLdJobPostingSchema)

export type JobPostingMetadata = {
  readonly organization: string
  readonly title: string
  readonly validThrough: string | null
}

export type ListingDocument = {
  readonly headings: readonly string[]
  readonly jobPostings: readonly JobPostingMetadata[]
  readonly text: string
  readonly title: string
}

const isJobPosting = (type: string | readonly string[]) =>
  type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))

const collectJobPostings = (value: unknown, output: JobPostingMetadata[]) => {
  if (Array.isArray(value)) {
    for (const item of value) collectJobPostings(item, output)
    return
  }

  const record = Option.getOrUndefined(decodeRecord(value))
  if (!record) return

  const posting = Option.getOrUndefined(decodeJobPosting(record))
  if (posting && isJobPosting(posting['@type'])) {
    output.push({
      organization: posting.hiringOrganization?.name ?? '',
      title: posting.title ?? '',
      validThrough: posting.validThrough ?? null,
    })
  }

  for (const nested of Object.values(record)) {
    collectJobPostings(nested, output)
  }
}

export const readListingDocument = (body: string): ListingDocument => {
  const document = parseDocument(body)
  const titleElement = DomUtils.findOne(
    (element) => element.name === 'title',
    document.children
  )
  const headings = DomUtils.findAll(
    (element) => element.name === 'h1' || element.name === 'h2',
    document.children
  ).map(DomUtils.textContent)
  const scripts = DomUtils.findAll(
    (element) =>
      element.name === 'script' &&
      element.attribs.type?.toLocaleLowerCase('en-US') ===
        'application/ld+json',
    document.children
  )
  const jobPostings: JobPostingMetadata[] = []

  for (const script of scripts) {
    const value = Option.getOrUndefined(
      decodeJson(DomUtils.textContent(script))
    )
    if (value !== undefined) collectJobPostings(value, jobPostings)
  }

  return {
    headings,
    jobPostings,
    text: DomUtils.textContent(document),
    title: titleElement ? DomUtils.textContent(titleElement) : '',
  }
}
