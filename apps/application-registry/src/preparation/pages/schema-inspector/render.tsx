import {
  CvDocumentV1Schema,
  cvDocumentV1ContractId,
  cvDocumentV1Version,
} from '@cv/contracts/document'
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@cv/internal-ui'
import { type EditorDescriptor, inspectSchema } from '@cv/schema-editor/core'
import { Braces, CircleAlert, LockKeyhole } from 'lucide-react'

import {
  cvDocumentV1AnnotatedJsonSchema,
  cvDocumentV1GuidanceItems,
  type SchemaGuidanceItem,
} from '../../document-contract'

export const DescriptorTree = ({
  descriptor,
  name,
}: {
  readonly descriptor: EditorDescriptor
  readonly name?: string
}) => {
  const label = name ?? descriptor.title ?? descriptor.kind
  const children =
    descriptor.kind === 'object'
      ? descriptor.fields.map((field) => (
          <DescriptorTree
            key={field.pointer}
            descriptor={field.descriptor}
            name={field.descriptor.title ?? field.key}
          />
        ))
      : descriptor.kind === 'array'
        ? [
            <DescriptorTree
              key="array-item"
              descriptor={descriptor.item}
              name="Array item"
            />,
          ]
        : descriptor.kind === 'nullable'
          ? [
              <DescriptorTree
                key="nullable-value"
                descriptor={descriptor.value}
                name="Non-null value"
              />,
            ]
          : descriptor.kind === 'union'
            ? descriptor.options.map((option) => (
                <DescriptorTree
                  key={option.id}
                  descriptor={option.descriptor}
                  name={option.label}
                />
              ))
            : []

  return (
    <li className="grid gap-2 rounded-md border border-border/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <Badge variant="outline">{descriptor.kind}</Badge>
        {descriptor.checked ? <Badge variant="secondary">checked</Badge> : null}
        {descriptor.encoded ? <Badge variant="secondary">encoded</Badge> : null}
      </div>
      {descriptor.description ? (
        <p className="text-xs text-muted-foreground">
          {descriptor.description}
        </p>
      ) : null}
      {children.length > 0 ? (
        <ul className="grid gap-2 border-l border-border pl-3">{children}</ul>
      ) : null}
    </li>
  )
}

export const GuidanceList = ({
  items,
}: {
  readonly items: ReadonlyArray<SchemaGuidanceItem>
}) => (
  <ol className="grid gap-3">
    {items.map((item) => (
      <li
        className="grid gap-2 rounded-md border border-border p-4"
        key={`${item.pointer}:${item.instruction}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <code className="text-xs text-muted-foreground">
            {item.pointer || '/'}
          </code>
          {item.title ? (
            <span className="text-sm font-semibold">{item.title}</span>
          ) : null}
          {item.maxWords === null ? null : (
            <Badge variant="outline">≤ {item.maxWords} words</Badge>
          )}
        </div>
        <p className="text-sm/6">{item.instruction}</p>
        <div className="flex flex-wrap gap-1.5">
          {item.sources.map((source) => (
            <Badge key={source} variant="secondary">
              {source}
            </Badge>
          ))}
        </div>
      </li>
    ))}
  </ol>
)

export const SchemaInspectorPage = () => {
  const inspection = inspectSchema(CvDocumentV1Schema)

  return (
    <section className="min-h-0 flex-1 overflow-y-auto bg-background p-4 lg:p-6">
      <div className="mx-auto grid max-w-6xl gap-5">
        <div>
          <p className="text-xs tracking-[0.18em] text-muted-foreground uppercase">
            Code-owned contract
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            CV document schema
          </h1>
          <p className="mt-2 max-w-3xl text-sm/6 text-muted-foreground">
            This page inspects the imported Effect schema at runtime. It does
            not modify the contract and does not contain CV-field-specific form
            logic.
          </p>
        </div>

        <Alert>
          <LockKeyhole />
          <AlertTitle>Read-only by design</AlertTitle>
          <AlertDescription>
            Structural schema changes are reviewed and shipped in code. The
            management browser consumes the result as a runtime variable.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Braces className="size-4" />
              Contract overview
            </CardTitle>
            <CardDescription>
              {cvDocumentV1ContractId} · version {cvDocumentV1Version}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {inspection.structurallyEditable
                ? 'Generic structured editor supported'
                : 'Raw JSON fallback required'}
            </Badge>
            <Badge variant="outline">
              {cvDocumentV1GuidanceItems.length} model guidance annotations
            </Badge>
            <Badge variant="outline">
              {inspection.unsupported.length} unsupported schema nodes
            </Badge>
          </CardContent>
        </Card>

        {inspection.unsupported.length > 0 ? (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Some nodes use raw JSON editing</AlertTitle>
            <AlertDescription>
              {inspection.unsupported
                .map((node) => `${node.pointer || '/'}: ${node.reason}`)
                .join(' · ')}
            </AlertDescription>
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Runtime inspection</CardTitle>
            <CardDescription>
              Shape, model guidance, and generated JSON Schema all come from the
              same imported contract.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="guidance">
              <TabsList>
                <TabsTrigger value="guidance">Model guidance</TabsTrigger>
                <TabsTrigger value="shape">Editor shape</TabsTrigger>
                <TabsTrigger value="json-schema">JSON Schema</TabsTrigger>
              </TabsList>
              <TabsContent value="guidance" className="mt-4">
                <GuidanceList items={cvDocumentV1GuidanceItems} />
              </TabsContent>
              <TabsContent value="shape" className="mt-4">
                <ul className="grid gap-3">
                  <DescriptorTree descriptor={inspection.descriptor} />
                </ul>
              </TabsContent>
              <TabsContent value="json-schema" className="mt-4">
                <pre className="max-h-192 overflow-auto rounded-md border border-border bg-muted p-4 text-xs">
                  {JSON.stringify(cvDocumentV1AnnotatedJsonSchema, null, 2)}
                </pre>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
