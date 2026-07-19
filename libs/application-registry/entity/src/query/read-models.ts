import { Schema } from 'effect'
import { type Application, ApplicationSchema } from '../codecs/applications'
import {
  type ApplicationCompensation,
  ApplicationCompensationSchema,
} from '../codecs/compensations'
import { type ApplicationEvent, ApplicationEventSchema } from '../codecs/events'
import { NonEmptyTrimmedStringSchema } from '../model/constraints'

/** Annual range in the list query's requested display currency. */
export type AnnualCompensation = Pick<
  ApplicationCompensation,
  'currencyCode' | 'maximumMinor' | 'minimumMinor'
>

/** Runtime schema for {@link AnnualCompensation}. */
export const AnnualCompensationSchema: Schema.Codec<AnnualCompensation> =
  Schema.revealCodec(
    Schema.Struct({
      currencyCode: ApplicationCompensationSchema.fields.currencyCode,
      maximumMinor: ApplicationCompensationSchema.fields.maximumMinor,
      minimumMinor: ApplicationCompensationSchema.fields.minimumMinor,
    }).pipe(
      Schema.check(
        Schema.makeFilter((value: AnnualCompensation) =>
          value.minimumMinor === null ||
          value.maximumMinor === null ||
          value.minimumMinor <= value.maximumMinor
            ? undefined
            : {
                path: ['maximumMinor'],
                issue:
                  'Annual compensation maximum must be greater than or equal to the minimum.',
              }
        )
      )
    )
  )

/** Application representation returned by list queries. */
export type ApplicationListItem = Application & {
  readonly annualCompensation: AnnualCompensation | null
  readonly counts: { readonly notes: number }
  readonly identityAliases: readonly string[]
  readonly labels: readonly string[]
  readonly latestEvent: Pick<ApplicationEvent, 'kind' | 'occurredAt'> | null
}

/** Runtime schema for {@link ApplicationListItem}. */
export const ApplicationListItemSchema: Schema.Codec<ApplicationListItem> =
  Schema.revealCodec(
    Schema.Struct({
      ...ApplicationSchema.fields,
      annualCompensation: Schema.NullOr(AnnualCompensationSchema),
      counts: Schema.Struct({
        notes: Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0))),
      }),
      identityAliases: Schema.Array(NonEmptyTrimmedStringSchema),
      labels: Schema.Array(NonEmptyTrimmedStringSchema),
      latestEvent: Schema.NullOr(
        Schema.Struct({
          kind: ApplicationEventSchema.fields.kind,
          occurredAt: ApplicationEventSchema.fields.occurredAt,
        })
      ),
    })
  )

/** Event representation returned by registry-wide list queries. */
export type RegistryEventListItem = ApplicationEvent &
  Pick<Application, 'canonicalUrl' | 'company' | 'role'>

/** Runtime schema for {@link RegistryEventListItem}. */
export const RegistryEventListItemSchema: Schema.Codec<RegistryEventListItem> =
  Schema.revealCodec(
    Schema.Struct({
      ...ApplicationEventSchema.fields,
      canonicalUrl: ApplicationSchema.fields.canonicalUrl,
      company: ApplicationSchema.fields.company,
      role: ApplicationSchema.fields.role,
    })
  )
