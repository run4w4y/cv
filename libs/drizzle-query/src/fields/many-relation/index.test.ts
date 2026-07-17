import { Database } from 'bun:sqlite'
import { describe, expect, test } from 'bun:test'
import { asc, eq, type SQL, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import {
  defineQuery,
  type ManyRelationOptions,
  pagePagination,
  QueryError,
} from '../../index'

const applications = sqliteTable('relation_applications', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
})

const tags = sqliteTable('relation_tags', {
  id: integer('id').primaryKey(),
  slug: text('slug').notNull().unique(),
})

const applicationTags = sqliteTable('relation_application_tags', {
  applicationId: integer('application_id').notNull(),
  tagId: integer('tag_id').notNull(),
})

const orders = sqliteTable('relation_orders', {
  id: integer('id').primaryKey(),
  applicationId: integer('application_id').notNull(),
  amount: integer('amount').notNull(),
})

const relationQuery = defineQuery(
  applications,
  ({ col, rel }) => [
    col.id.filterable().sortable({ unique: true }),
    col.name.filterable(),
    rel
      .many(tags, {
        value: ({ related }) => related.slug,
        on: ({ root, related }) =>
          sql`exists (
            select 1
            from ${applicationTags}
            where ${applicationTags.applicationId} = ${root.id}
              and ${applicationTags.tagId} = ${related.id}
          )`,
      })
      .as('tags')
      .filterable(),
    rel
      .many(tags, {
        value: ({ related }) => sql<string>`lower(${related.slug})`,
        bind: (value) => sql.param(value.toLocaleLowerCase('en-US')),
        on: ({ root, related }) =>
          sql`exists (
            select 1
            from ${applicationTags}
            where ${applicationTags.applicationId} = ${root.id}
              and ${applicationTags.tagId} = ${related.id}
          )`,
      })
      .as('normalizedTags')
      .filterable(),
    rel
      .many(orders, {
        value: ({ related }) => related.id,
        on: ({ root, related }) => eq(related.applicationId, root.id),
      })
      .count()
      .as('orderCount')
      .filterable()
      .sortable(),
  ],
  {
    pagination: pagePagination({ defaultSize: 20 }),
    defaultOrderBy: [{ field: 'id' }],
  }
)

type RelationRequest = NonNullable<Parameters<typeof relationQuery.resolve>[0]>
type RelationFilters = NonNullable<RelationRequest['filters']>
type RelationCondition = Extract<
  RelationFilters[number],
  { readonly type: 'condition' }
>
const condition = <const Condition extends RelationCondition>(
  value: Condition
): Condition => value

const relationTypeContracts = (): void => {
  const computedRelation: ManyRelationOptions<
    typeof applications,
    typeof tags,
    SQL<string>
  > = {
    value: ({ related }) => sql<string>`lower(${related.slug})`,
    bind: (value) => sql.param(value.toLocaleLowerCase('en-US')),
    on: ({ root, related }) => eq(related.id, root.id),
  }

  // @ts-expect-error Broad relation options still require a binder for SQL values.
  const annotatedComputedWithoutBinder: ManyRelationOptions<
    typeof applications,
    typeof tags
  > = {
    value: ({ related }) => sql<string>`lower(${related.slug})`,
    on: ({ root, related }) => eq(related.id, root.id),
  }

  defineQuery(
    applications,
    ({ col, rel }) => {
      const computedWithoutBinder = {
        value: ({ related }: { readonly related: typeof tags._.columns }) =>
          sql<string>`lower(${related.slug})`,
        on: ({
          root,
          related,
        }: {
          readonly root: typeof applications._.columns
          readonly related: typeof tags._.columns
        }) => eq(related.id, root.id),
      }

      return [
        col.id.sortable({ unique: true }),
        rel.many(tags, computedRelation).as('annotated').filterable(),
        rel
          // @ts-expect-error Drizzle columns use their own encoder and do not accept bind.
          .many(tags, {
            value: ({ related }) => related.slug,
            bind: (value) => sql.param(value),
            on: ({ root, related }) => eq(related.id, root.id),
          })
          .as('boundColumn')
          .filterable(),
        // @ts-expect-error SQL-backed relation values require an explicit binder.
        rel.many(tags, computedWithoutBinder).as('computed').filterable(),
      ]
    },
    { pagination: pagePagination() }
  )

  void annotatedComputedWithoutBinder
}

void relationTypeContracts

const withDatabase = async <Value>(
  use: (database: ReturnType<typeof drizzle>) => Promise<Value>
): Promise<Value> => {
  const sqlite = new Database(':memory:')
  sqlite.exec(`
    create table relation_applications (
      id integer primary key,
      name text not null
    );
    create table relation_tags (
      id integer primary key,
      slug text not null unique
    );
    create table relation_application_tags (
      application_id integer not null,
      tag_id integer not null
    );
    create table relation_orders (
      id integer primary key,
      application_id integer not null,
      amount integer not null
    );
  `)

  try {
    const database = drizzle({ client: sqlite })
    await database.insert(applications).values([
      { id: 1, name: 'alpha' },
      { id: 2, name: 'beta' },
      { id: 3, name: 'alphabet' },
    ])
    await database.insert(tags).values([
      { id: 1, slug: 'vip' },
      { id: 2, slug: 'remote' },
    ])
    await database.insert(applicationTags).values([
      { applicationId: 1, tagId: 1 },
      { applicationId: 1, tagId: 2 },
      { applicationId: 2, tagId: 1 },
    ])
    await database.insert(orders).values([
      { id: 1, applicationId: 1, amount: 100 },
      { id: 2, applicationId: 1, amount: 200 },
      { id: 3, applicationId: 3, amount: 50 },
    ])
    return await use(database)
  } finally {
    sqlite.close()
  }
}

const idsFor = (filters: RelationFilters): Promise<readonly number[]> =>
  withDatabase(async (database) => {
    const resolved = relationQuery.resolve({ filters })
    const rows = await resolved
      .apply(
        database.select({ id: applications.id }).from(applications).$dynamic()
      )
      .all()
    return resolved.finalize(rows).items.map(({ id }) => id)
  })

describe('correlated relationship fields', () => {
  test('requires an explicit alias for self-relations', () => {
    expect(() =>
      defineQuery(
        applications,
        ({ col, rel }) => [
          col.id.sortable({ unique: true }),
          rel
            .many(applications, {
              value: ({ related }) => related.id,
              on: ({ root, related }) => eq(related.id, root.id),
            })
            .as('related')
            .filterable(),
        ],
        { pagination: pagePagination() }
      )
    ).toThrow(QueryError)
  })

  test('filters a many-to-many relation without joining the root query', async () => {
    expect(
      await idsFor([
        condition({
          type: 'condition',
          field: 'tags',
          operator: 'hasAny',
          value: ['remote'],
        }),
      ])
    ).toEqual([1])
    expect(
      await idsFor([
        condition({
          type: 'condition',
          field: 'tags',
          operator: 'hasAll',
          value: ['vip', 'remote'],
        }),
      ])
    ).toEqual([1])
    expect(
      await idsFor([
        condition({
          type: 'condition',
          field: 'tags',
          operator: 'hasNone',
          value: ['remote'],
        }),
      ])
    ).toEqual([2, 3])
    expect(
      await idsFor([
        condition({
          type: 'condition',
          field: 'tags',
          operator: 'isEmpty',
        }),
      ])
    ).toEqual([3])
    expect(
      await idsFor([
        condition({
          type: 'condition',
          field: 'tags',
          operator: 'isNotEmpty',
        }),
      ])
    ).toEqual([1, 2])
    expect(
      await idsFor([
        condition({
          type: 'condition',
          field: 'normalizedTags',
          operator: 'hasAny',
          value: ['REMOTE'],
        }),
      ])
    ).toEqual([1])
  })

  test('defines explicit empty-list semantics', async () => {
    expect(
      await idsFor([
        condition({
          type: 'condition',
          field: 'tags',
          operator: 'hasAny',
          value: [],
        }),
      ])
    ).toEqual([])
    expect(
      await idsFor([
        condition({
          type: 'condition',
          field: 'tags',
          operator: 'hasAll',
          value: [],
        }),
      ])
    ).toEqual([1, 2, 3])
    expect(
      await idsFor([
        condition({
          type: 'condition',
          field: 'tags',
          operator: 'hasNone',
          value: [],
        }),
      ])
    ).toEqual([1, 2, 3])
  })

  test('passes repeated values through every many-relation list operator', async () => {
    await withDatabase(async (database) => {
      for (const operator of ['hasAny', 'hasAll', 'hasNone'] as const) {
        const resolved = relationQuery.resolve({
          filters: [
            condition({
              type: 'condition',
              field: 'tags',
              operator,
              value: ['vip', 'vip'],
            }),
          ],
        })
        const statement = resolved
          .apply(
            database
              .select({ id: applications.id })
              .from(applications)
              .$dynamic()
          )
          .toSQL()

        expect(
          statement.params.filter((value) => value === 'vip')
        ).toHaveLength(2)
      }
    })
  })

  test('filters and orders by a correlated scalar count', async () => {
    expect(
      await idsFor([
        condition({
          type: 'condition',
          field: 'orderCount',
          operator: 'gte',
          value: 2,
        }),
      ])
    ).toEqual([1])

    await withDatabase(async (database) => {
      const resolved = relationQuery.resolve({
        orderBy: [{ field: 'orderCount', direction: 'desc' }],
      })
      const builder = resolved.apply(
        database.select({ id: applications.id }).from(applications).$dynamic()
      )
      const statement = builder.toSQL()
      expect(statement.sql.toLowerCase()).toContain('select count(*)')
      expect(statement.sql.toLowerCase()).not.toContain(' join ')

      const page = resolved.finalize(await builder.all())
      expect(page.items.map(({ id }) => id)).toEqual([1, 3, 2])
    })
  })

  test('leaves relationship projection to the consumer', async () => {
    await withDatabase(async (database) => {
      const projectedTags = sql<string>`(
        select coalesce(
          json_group_array(relation_tags.slug order by relation_tags.id),
          json('[]')
        )
        from relation_application_tags
        inner join relation_tags
          on relation_tags.id = relation_application_tags.tag_id
        where relation_application_tags.application_id = relation_applications.id
      )`.mapWith((value) => String(value))
      const resolved = relationQuery.resolve({
        orderBy: [{ field: 'id' }],
      })
      const rows = await resolved
        .apply(
          database
            .select({
              id: applications.id,
              tags: projectedTags,
              ...resolved.requiredSelection,
            })
            .from(applications)
            .$dynamic()
        )
        .all()
      const page = resolved.finalize(rows)

      expect(page.items).toEqual([
        { id: 1, tags: '["vip","remote"]' },
        { id: 2, tags: '["vip"]' },
        { id: 3, tags: '[]' },
      ])
    })
  })

  test('can use relation fragments independently', async () => {
    await withDatabase(async (database) => {
      const resolved = relationQuery.resolve({
        filters: [
          condition({
            type: 'condition',
            field: 'tags',
            operator: 'hasAny',
            value: ['vip'],
          }),
        ],
        orderBy: [{ field: 'id' }],
      })
      const rows = await database
        .select({ id: applications.id })
        .from(applications)
        .where(resolved.filtering.where)
        .orderBy(asc(applications.id))
        .all()
      expect(rows.map(({ id }) => id)).toEqual([1, 2])
    })
  })
})
