import type { PdfGenerationRequested } from '@cv/application-registry-api-contract'
import { Context, type Effect, type Option, Schema } from 'effect'

export const pdfQueueStreamName = 'CV_PDF'
export const pdfQueueSubject = 'cv.pdf.requested'
export const pdfQueueConsumerName = 'cv-pdf'

export class PdfQueueError extends Schema.TaggedErrorClass<PdfQueueError>()(
  'PdfQueueError',
  {
    cause: Schema.Defect(),
    message: Schema.String,
    operation: Schema.String,
  }
) {}

export interface PdfQueueConfiguration {
  readonly ackWaitMilliseconds: number
  readonly consumerName: string
  readonly duplicateWindowMilliseconds: number
  readonly maxDeliver: number
  readonly maxMessageBytes: number
  readonly maxMessages: number
  readonly maxStreamBytes: number
  readonly messageMaxAgeMilliseconds: number
  readonly nats: {
    readonly clientName: string
    readonly maxReconnectAttempts: number
    readonly password: string
    readonly server: string
    readonly username: string
  }
  readonly pullExpiresMilliseconds: number
  readonly streamName: string
  readonly subject: string
}

export const makePdfQueueConfiguration = (
  input: Pick<PdfQueueConfiguration, 'nats'> &
    Partial<Omit<PdfQueueConfiguration, 'nats'>>
): PdfQueueConfiguration => ({
  ackWaitMilliseconds: 120_000,
  consumerName: pdfQueueConsumerName,
  duplicateWindowMilliseconds: 86_400_000,
  maxDeliver: 5,
  maxMessageBytes: 16 * 1_024,
  maxMessages: 10_000,
  maxStreamBytes: 256 * 1_024 * 1_024,
  messageMaxAgeMilliseconds: 7 * 24 * 60 * 60 * 1_000,
  pullExpiresMilliseconds: 30_000,
  streamName: pdfQueueStreamName,
  subject: pdfQueueSubject,
  ...input,
})

export interface PdfQueueMessage {
  readonly ack: Effect.Effect<void>
  readonly bytes: Uint8Array
  readonly deliveryCount: number
  readonly nak: (delayMilliseconds: number) => Effect.Effect<void>
  readonly sequence: number
  readonly term: (reason: string) => Effect.Effect<void>
  readonly working: Effect.Effect<void>
}

export interface PdfQueueShape {
  readonly configuration: PdfQueueConfiguration
  readonly publish: (
    request: PdfGenerationRequested
  ) => Effect.Effect<void, PdfQueueError>
  readonly take: Effect.Effect<Option.Option<PdfQueueMessage>, PdfQueueError>
}

export class PdfQueue extends Context.Service<PdfQueue, PdfQueueShape>()(
  '@cv/application-registry-pdf-queue/PdfQueue'
) {}
