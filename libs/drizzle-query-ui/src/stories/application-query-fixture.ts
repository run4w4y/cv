import type {
  QueryFilterDefinition,
  QueryFilterFieldPresentation,
  QueryFiltersState,
} from '../model'

export const applicationQueryDefinition = {
  fields: [
    {
      name: 'company',
      origin: 'column',
      filterOperatorInfo: [
        { name: 'contains', kind: 'binary', value: { type: 'string' } },
        { name: 'eq', kind: 'binary', value: { type: 'string' } },
        { name: 'isNull', kind: 'unary' },
      ],
      sortable: true,
      unique: false,
      nullable: true,
    },
    {
      name: 'applicationStatus',
      origin: 'column',
      filterOperatorInfo: [
        {
          name: 'eq',
          kind: 'binary',
          value: {
            type: 'enum',
            values: ['draft', 'applied', 'interview', 'offer', 'rejected'],
          },
        },
        {
          name: 'in',
          kind: 'binary',
          value: {
            type: 'array',
            item: {
              type: 'enum',
              values: ['draft', 'applied', 'interview', 'offer', 'rejected'],
            },
          },
        },
        { name: 'isNotNull', kind: 'unary' },
      ],
      sortable: true,
      unique: false,
      nullable: true,
    },
    {
      name: 'personalPriority',
      origin: 'column',
      filterOperatorInfo: [
        {
          name: 'eq',
          kind: 'binary',
          value: {
            type: 'enum',
            values: ['low', 'medium', 'high'],
          },
        },
      ],
      sortable: true,
      unique: false,
      nullable: false,
    },
    {
      name: 'fitScore',
      origin: 'column',
      filterOperatorInfo: [
        { name: 'gte', kind: 'binary', value: { type: 'number' } },
        {
          name: 'between',
          kind: 'binary',
          value: {
            type: 'tuple',
            items: [{ type: 'number' }, { type: 'number' }],
          },
        },
      ],
      sortable: true,
      unique: false,
      nullable: true,
    },
    {
      name: 'followUpAt',
      origin: 'column',
      filterOperatorInfo: [
        {
          name: 'between',
          kind: 'binary',
          value: {
            type: 'tuple',
            items: [{ type: 'date' }, { type: 'date' }],
          },
        },
        { name: 'isNull', kind: 'unary' },
      ],
      sortable: true,
      unique: false,
      nullable: true,
    },
    {
      name: 'labels',
      origin: 'relation',
      filterOperatorInfo: [
        {
          name: 'hasAny',
          kind: 'binary',
          value: { type: 'array', item: { type: 'string' } },
        },
        { name: 'isEmpty', kind: 'unary' },
      ],
      sortable: false,
      unique: false,
      nullable: false,
    },
    {
      name: 'q',
      origin: 'expression',
      filterOperatorInfo: [
        { name: 'matches', kind: 'binary', value: { type: 'string' } },
      ],
      sortable: false,
      unique: false,
      nullable: false,
    },
  ],
} as const satisfies QueryFilterDefinition

const humanize = (value: string) =>
  value.replace(/^./u, (character) => character.toLocaleUpperCase('en-US'))

const statusValues = [
  'draft',
  'applied',
  'interview',
  'offer',
  'rejected',
] as const

export const applicationFieldPresentation = {
  q: { hidden: true },
  applicationStatus: {
    label: 'Application status',
    description: 'Current application lifecycle state',
    options: statusValues.map((value) => ({
      label: humanize(value),
      value,
    })),
  },
  company: {
    description: 'Normalized company name',
    options: ['Acme', 'Northstar', 'Atlas'].map((value) => ({
      label: value,
      value,
    })),
  },
  fitScore: {
    label: 'Fit score',
    description: 'Campaign fit score from zero to one hundred',
  },
  followUpAt: {
    label: 'Follow-up time',
    description: 'Scheduled follow-up timestamp',
  },
  labels: {
    description: 'Internal application labels',
    options: ['remote', 'platform', 'high-signal'].map((value) => ({
      label: humanize(value),
      value,
    })),
  },
  personalPriority: {
    label: 'Personal priority',
    options: ['low', 'medium', 'high'].map((value) => ({
      label: humanize(value),
      value,
    })),
  },
} satisfies Readonly<Record<string, QueryFilterFieldPresentation>>

export const seededApplicationFilters = (): QueryFiltersState => ({
  combinator: 'and',
  conditions: [
    {
      type: 'condition',
      field: 'applicationStatus',
      operator: 'in',
      value: ['applied', 'interview'],
    },
    {
      type: 'condition',
      field: 'fitScore',
      operator: 'gte',
      value: 75,
    },
    {
      type: 'condition',
      field: 'labels',
      operator: 'hasAny',
      value: ['remote', 'high-signal'],
    },
  ],
})
