import { Schema } from 'effect'
import {
  type ApplicationActivity,
  ApplicationActivitySchema,
} from '../codecs/activities'
import { type Application, ApplicationSchema } from '../codecs/applications'
import {
  type ApplicationCompensation,
  ApplicationCompensationSchema,
  compensationRangeOrderFilter,
} from '../codecs/compensations'
import { NonEmptyTrimmedStringSchema } from '../model/constraints'

/** Annual range in its stored currency. */
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
    }).pipe(Schema.check(compensationRangeOrderFilter))
  )

/** Application representation returned by list queries. */
export type ApplicationListItem = Application & {
  readonly annualCompensation: AnnualCompensation | null
  readonly counts: { readonly notes: number }
  readonly labels: readonly string[]
  readonly latestActivity: Pick<
    ApplicationActivity,
    'kind' | 'occurredAt'
  > | null
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
      labels: Schema.Array(NonEmptyTrimmedStringSchema),
      latestActivity: Schema.NullOr(
        Schema.Struct({
          kind: ApplicationActivitySchema.fields.kind,
          occurredAt: ApplicationActivitySchema.fields.occurredAt,
        })
      ),
    })
  )

/** Activity representation returned by registry-wide list queries. */
export type RegistryActivityListItem = ApplicationActivity &
  Pick<Application, 'postingUrl' | 'company' | 'role'>

/** Runtime schema for {@link RegistryActivityListItem}. */
export const RegistryActivityListItemSchema: Schema.Codec<RegistryActivityListItem> =
  Schema.revealCodec(
    Schema.Struct({
      ...ApplicationActivitySchema.fields,
      postingUrl: ApplicationSchema.fields.postingUrl,
      company: ApplicationSchema.fields.company,
      role: ApplicationSchema.fields.role,
    })
  )
