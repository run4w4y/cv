#!/usr/bin/env bun

import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { format } from "prettier";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

type Options = {
  contentRoot: string;
  legacyCvRoot: string;
  outputRoot: string;
  verifyLock: boolean;
  writeLock: boolean;
};

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const activeCvRoot = resolve(scriptDirectory, "../..");
const trackedLockPath = join(scriptDirectory, "legacy-source.lock.json");
const snapshotMarker = ".legacy-cv-private-snapshot";
const legacyCodePaths = [
  "apps/cv/src/cv-content",
  "libs/content-astro",
  "libs/content-build",
  "libs/content-composer",
  "libs/content-core",
  "libs/private-content-crypto",
  "libs/private-content-protocol",
] as const;

const usage = () => `Usage: bun docs/legacy-migration/materialize.ts [options]

Options:
  --content-root <path>    cv-content checkout (default: ../cv-content)
  --legacy-cv-root <path> CV checkout containing the legacy composer
  --output <path>          ignored private output directory
  --verify-lock            compare the recomposed safe lock with the tracked lock
  --write-lock             replace the tracked safe lock intentionally
  --help                   show this help
`;

const parseOptions = (argv: readonly string[]): Options => {
  const options: Options = {
    contentRoot: resolve(activeCvRoot, "../cv-content"),
    legacyCvRoot: activeCvRoot,
    outputRoot: join(scriptDirectory, "private-output"),
    verifyLock: false,
    writeLock: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--help") {
      console.log(usage());
      process.exit(0);
    }

    if (argument === "--verify-lock") {
      options.verifyLock = true;
      continue;
    }

    if (argument === "--write-lock") {
      options.writeLock = true;
      continue;
    }

    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${argument}\n\n${usage()}`);
    }

    if (argument === "--content-root") {
      options.contentRoot = resolve(value);
    } else if (argument === "--legacy-cv-root") {
      options.legacyCvRoot = resolve(value);
    } else if (argument === "--output") {
      options.outputRoot = resolve(value);
    } else {
      throw new Error(`Unknown option ${argument}\n\n${usage()}`);
    }

    index += 1;
  }

  if (options.verifyLock && options.writeLock) {
    throw new Error("--verify-lock and --write-lock are mutually exclusive");
  }

  return options;
};

const sha256 = (value: string | Uint8Array) =>
  createHash("sha256").update(value).digest("hex");

const canonicalize = (value: unknown): Json => {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (typeof value !== "object") {
    throw new Error(`Cannot canonicalize ${typeof value}`);
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, canonicalize(child)]),
  );
};

const json = (value: unknown) =>
  `${JSON.stringify(canonicalize(value), null, 2)}\n`;

const formattedJson = (value: unknown) =>
  format(json(value), {
    parser: "json",
  });

const git = async (root: string, args: readonly string[]) => {
  const process = Bun.spawn(["git", "-C", root, ...args], {
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stderr, stdout] = await Promise.all([
    process.exited,
    new Response(process.stderr).text(),
    new Response(process.stdout).text(),
  ]);

  if (exitCode !== 0) {
    throw new Error(
      `git -C ${root} ${args.join(" ")} failed: ${stderr.trim()}`,
    );
  }

  return stdout;
};

const gitLine = async (root: string, args: readonly string[]) =>
  (await git(root, args)).trim();

const assertDirectory = async (path: string, label: string) => {
  const info = await stat(path).catch(() => null);

  if (!info?.isDirectory()) {
    throw new Error(`${label} is not a directory: ${path}`);
  }
};

const isPathInside = (parent: string, child: string) => {
  const path = relative(resolve(parent), resolve(child));

  return path.length > 0 && !path.startsWith("..") && !isAbsolute(path);
};

const assertSafeOutput = (options: Options) => {
  const output = resolve(options.outputRoot);
  const forbidden = new Set([
    resolve("/"),
    resolve(homedir()),
    resolve(activeCvRoot),
    resolve(options.legacyCvRoot),
    resolve(options.contentRoot),
  ]);

  if (forbidden.has(output)) {
    throw new Error(`Refusing unsafe output directory: ${output}`);
  }

  if (!isPathInside(activeCvRoot, output) && basename(output).length < 8) {
    throw new Error(
      `Output outside the active CV repository must have a descriptive basename: ${output}`,
    );
  }
};

const prepareOutput = async (outputRoot: string) => {
  const existing = await stat(outputRoot).catch(() => null);

  if (existing) {
    const marker = join(outputRoot, snapshotMarker);
    const markerValue = await readFile(marker, "utf8").catch(() => "");

    if (markerValue.trim() !== "legacy-cv-private-snapshot.v1") {
      throw new Error(
        `Refusing to replace ${outputRoot}: expected ${snapshotMarker}`,
      );
    }

    await rm(outputRoot, { force: true, recursive: true });
  }

  const stagingRoot = `${outputRoot}.staging-${process.pid}`;
  const staging = await stat(stagingRoot).catch(() => null);

  if (staging) {
    throw new Error(`Staging directory already exists: ${stagingRoot}`);
  }

  await mkdir(stagingRoot, { recursive: true });
  await writeFile(
    join(stagingRoot, snapshotMarker),
    "legacy-cv-private-snapshot.v1\n",
  );

  return stagingRoot;
};

const finishOutput = async (stagingRoot: string, outputRoot: string) => {
  await rename(stagingRoot, outputRoot);
};

const normalizePath = (path: string) => path.split(sep).join("/");

const extension = (path: string) => extname(path).toLowerCase() || "<none>";

const mediaType = (path: string) => {
  switch (extension(path)) {
    case ".pdf":
      return "application/pdf";
    case ".json":
      return "application/json";
    case ".mdx":
    case ".md":
      return "text/markdown";
    case ".ts":
    case ".tsx":
      return "text/typescript";
    default:
      return "application/octet-stream";
  }
};

type TrackedFile = {
  blob: string;
  bytes: number;
  extension: string;
  mode: string;
  path: string;
  sha256: string;
};

const trackedFiles = async (root: string): Promise<TrackedFile[]> => {
  const staged = await git(root, ["ls-files", "--stage", "-z"]);
  const records = staged.split("\0").filter(Boolean);
  const files: TrackedFile[] = [];

  for (const record of records) {
    const match = record.match(
      /^(?<mode>\d+) (?<blob>[a-f0-9]+) \d+\t(?<path>.+)$/u,
    );

    if (!match?.groups) {
      throw new Error(`Could not parse git ls-files entry: ${record}`);
    }

    const path = normalizePath(match.groups.path);
    const bytes = new Uint8Array(
      await Bun.file(join(root, path)).arrayBuffer(),
    );

    files.push({
      blob: match.groups.blob,
      bytes: bytes.byteLength,
      extension: extension(path),
      mode: match.groups.mode,
      path,
      sha256: sha256(bytes),
    });
  }

  return files.sort((left, right) => left.path.localeCompare(right.path));
};

const copyTrackedTree = async (
  root: string,
  files: readonly TrackedFile[],
  destination: string,
) => {
  for (const file of files) {
    const target = join(destination, file.path);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(join(root, file.path), target);
  }
};

const countsBy = <Value>(
  values: readonly Value[],
  key: (value: Value) => string,
) =>
  Object.fromEntries(
    [
      ...values.reduce((counts, value) => {
        const name = key(value);
        counts.set(name, (counts.get(name) ?? 0) + 1);
        return counts;
      }, new Map<string, number>()),
    ].sort(([left], [right]) => left.localeCompare(right)),
  );

const pointerSegment = (segment: string) =>
  segment.replaceAll("~", "~0").replaceAll("/", "~1");

const normalizeText = (value: string) => value.trim().replace(/\s+/gu, " ");

const textKind = (pointer: string) => {
  const field = pointer.split("/").at(-1) ?? "";

  if (field === "href") return "link-target";
  if (["id", "slug", "type", "index", "icon", "dir"].includes(field)) {
    return "structural";
  }
  if (pointer.includes("/provenance/")) return "provenance";
  if (["lastUpdated", "period"].includes(field)) return "date-or-period";
  if (
    ["stack", "items", "printStack"].some((name) =>
      pointer.includes(`/${name}/`),
    )
  ) {
    return "taxonomy-item";
  }
  return "authored-copy";
};

const linkKind = (target: string) => {
  if (target.startsWith("/files/")) return "content-file";
  if (target.startsWith("mailto:")) return "email";
  if (target.startsWith("tel:")) return "telephone";
  if (target.startsWith("#")) return "fragment";
  if (target.startsWith("http://") || target.startsWith("https://")) {
    return "external-url";
  }
  return "other";
};

type TextOccurrence = {
  kind: string;
  locale: string;
  pointer: string;
  profile: string;
  value: string;
};

type LinkOccurrence = {
  kind: string;
  locale: string;
  pointer: string;
  profile: string;
  target: string;
};

type VariableOccurrence = {
  descriptor: Record<string, unknown>;
  locale: string;
  pointer: string;
  profile: string;
  variable: string;
};

const collectOccurrences = (
  value: unknown,
  context: { locale: string; profile: string },
  texts: TextOccurrence[],
  links: LinkOccurrence[],
  variables: VariableOccurrence[],
  pointer = "",
) => {
  if (typeof value === "string") {
    texts.push({
      ...context,
      kind: textKind(pointer),
      pointer,
      value,
    });

    if (
      pointer.endsWith("/href") ||
      /^(?:https?:\/\/|mailto:|tel:|\/files\/|#)/u.test(value)
    ) {
      links.push({
        ...context,
        kind: linkKind(value),
        pointer,
        target: value,
      });
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((child, index) =>
      collectOccurrences(
        child,
        context,
        texts,
        links,
        variables,
        `${pointer}/${index}`,
      ),
    );
    return;
  }

  if (!value || typeof value !== "object") return;

  const record = value as Record<string, unknown>;

  if (
    (record.kind === "VariableLookup" || record.kind === "RedactedSection") &&
    typeof record.variable === "string"
  ) {
    variables.push({
      ...context,
      descriptor: { ...record },
      pointer,
      variable: record.variable,
    });
  }

  for (const [key, child] of Object.entries(record)) {
    collectOccurrences(
      child,
      context,
      texts,
      links,
      variables,
      `${pointer}/${pointerSegment(key)}`,
    );
  }
};

const groupTexts = (occurrences: readonly TextOccurrence[]) => {
  const groups = new Map<string, TextOccurrence[]>();

  for (const occurrence of occurrences) {
    const normalized = normalizeText(occurrence.value);
    const key = `${sha256(normalized)}:${occurrence.kind}`;
    const group = groups.get(key) ?? [];
    group.push(occurrence);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([key, items]) => {
      const [textHash, kind] = key.split(":");
      const value = items[0]?.value ?? "";

      return {
        disposition: null,
        id: `legacy.text.${textHash.slice(0, 16)}`,
        kind,
        normalizedSha256: textHash,
        occurrences: items
          .map(({ locale, pointer, profile }) => ({ locale, pointer, profile }))
          .sort((left, right) =>
            `${left.locale}/${left.profile}${left.pointer}`.localeCompare(
              `${right.locale}/${right.profile}${right.pointer}`,
            ),
          ),
        reviewStatus: "pending",
        value,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
};

const groupLinks = (occurrences: readonly LinkOccurrence[]) => {
  const groups = new Map<string, LinkOccurrence[]>();

  for (const occurrence of occurrences) {
    const key = `${sha256(occurrence.target)}:${occurrence.kind}`;
    const group = groups.get(key) ?? [];
    group.push(occurrence);
    groups.set(key, group);
  }

  return [...groups.entries()]
    .map(([key, items]) => {
      const [targetHash, kind] = key.split(":");

      return {
        disposition: null,
        id: `legacy.link.${targetHash.slice(0, 16)}`,
        kind,
        occurrences: items
          .map(({ locale, pointer, profile }) => ({ locale, pointer, profile }))
          .sort((left, right) =>
            `${left.locale}/${left.profile}${left.pointer}`.localeCompare(
              `${right.locale}/${right.profile}${right.pointer}`,
            ),
          ),
        reviewStatus: "pending",
        target: items[0]?.target ?? "",
        targetSha256: targetHash,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
};

const valueShape = (value: unknown): Json => {
  if (typeof value === "string") return "string";
  if (Array.isArray(value))
    return ["array", ...new Set(value.map((item) => typeof item))];
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as object)
        .sort()
        .map((key) => [
          key,
          valueShape((value as Record<string, unknown>)[key]),
        ]),
    );
  }
  return typeof value;
};

const main = async () => {
  const options = parseOptions(Bun.argv.slice(2));
  assertSafeOutput(options);
  await Promise.all([
    assertDirectory(options.legacyCvRoot, "Legacy CV root"),
    assertDirectory(options.contentRoot, "cv-content root"),
  ]);

  const contentStatus = await git(options.contentRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]);

  if (contentStatus.trim()) {
    throw new Error(
      `cv-content must be clean before preservation:\n${contentStatus.trim()}`,
    );
  }

  const legacyStatus = await git(options.legacyCvRoot, [
    "status",
    "--porcelain=v1",
    "--untracked-files=no",
    "--",
    ...legacyCodePaths,
  ]);

  if (legacyStatus.trim()) {
    throw new Error(
      `Legacy composer paths must be clean before preservation:\n${legacyStatus.trim()}`,
    );
  }

  const loaderPath = join(
    options.legacyCvRoot,
    "libs/content-astro/dist/load-snapshot.js",
  );
  const sourceRepositoryPath = join(
    options.legacyCvRoot,
    "libs/content-astro/dist/source-repository.js",
  );
  const contractPath = join(
    options.legacyCvRoot,
    "apps/cv/src/cv-content/contract.ts",
  );

  for (const path of [loaderPath, sourceRepositoryPath, contractPath]) {
    if (!(await stat(path).catch(() => null))) {
      throw new Error(
        `Missing legacy build input ${path}. Build the legacy content packages first.`,
      );
    }
  }

  const [
    { loadContentSource },
    { openContentSourceRepository },
    contractModule,
  ] = await Promise.all([
    import(pathToFileURL(loaderPath).href),
    import(pathToFileURL(sourceRepositoryPath).href),
    import(pathToFileURL(contractPath).href),
  ]);
  const contract = contractModule.cvContentContract;

  if (!contract || typeof loadContentSource !== "function") {
    throw new Error("Legacy content modules did not expose the expected API");
  }

  const [source, sourceRepository, contentFiles] = await Promise.all([
    loadContentSource({ contentRoot: options.contentRoot, contract }),
    openContentSourceRepository({ contentRoot: options.contentRoot }),
    trackedFiles(options.contentRoot),
  ]);
  const manifest = source.manifest as {
    content: Record<string, Record<string, unknown>>;
    contentSchema: string;
    locales: readonly string[];
    profiles: readonly string[];
    schema: string;
  };
  const texts: TextOccurrence[] = [];
  const links: LinkOccurrence[] = [];
  const variableOccurrences: VariableOccurrence[] = [];
  const profileEntries: Array<Record<string, unknown>> = [];
  const profileSources: Array<Record<string, unknown>> = [];

  for (const locale of [...manifest.locales].sort()) {
    const profiles = Object.keys(manifest.content[locale] ?? {}).sort();

    for (const profile of profiles) {
      const content = manifest.content[locale]?.[profile];
      const composed = json(content);
      collectOccurrences(
        content,
        { locale, profile },
        texts,
        links,
        variableOccurrences,
      );

      profileEntries.push({
        composedSha256: sha256(composed),
        locale,
        profile,
        sectionOrder: Array.isArray(
          (content as { sections?: unknown }).sections,
        )
          ? (content as { sections: Array<{ id?: unknown }> }).sections
              .map((section) => section.id)
              .filter((id): id is string => typeof id === "string")
          : [],
      });

      const authored = await sourceRepository.loadProfileSources({
        locale,
        profile,
      });
      profileSources.push({
        layers: authored.layers.map((layer: Record<string, any>) => ({
          locale: layer.locale,
          profile: layer.profile,
          sources: layer.sources.map((item: Record<string, any>) => ({
            kind: item.kind,
            path: item.modulePath,
            sectionPath: item.path,
            sha256: sha256(item.source),
            sourceProfile: item.sourceProfile,
          })),
        })),
        locale,
        profile,
        sharedSources: authored.sharedSources.map(
          (item: Record<string, any>) => ({
            kind: item.kind,
            path: item.modulePath,
            sha256: sha256(item.source),
          }),
        ),
      });
    }
  }

  const textItems = groupTexts(texts);
  const linkItems = groupLinks(links);
  const variableValues = (source.variableSource?.variables ?? {}) as Record<
    string,
    unknown
  >;
  const variableNames = [
    ...new Set([
      ...Object.keys(variableValues),
      ...variableOccurrences.map((item) => item.variable),
    ]),
  ].sort();
  const variableItems = variableNames.map((name) => ({
    disposition: null,
    id: `legacy.variable.${name}`,
    name,
    occurrences: variableOccurrences
      .filter((item) => item.variable === name)
      .map(({ descriptor, locale, pointer, profile }) => ({
        descriptor,
        locale,
        pointer,
        profile,
      })),
    reviewStatus: "pending",
    sourceValue: variableValues[name],
    sourceValueShape: valueShape(variableValues[name]),
  }));
  const contentDir = sourceRepository.config.contentDir as string;
  const assetFiles = contentFiles.filter((file) =>
    file.path.startsWith(`${contentDir}/files/`),
  );
  const assetItems = assetFiles.map((file) => {
    const publicTarget = `/files/${basename(file.path)}`;

    return {
      bytes: file.bytes,
      disposition: null,
      id: `legacy.asset.${file.sha256.slice(0, 16)}`,
      mediaType: mediaType(file.path),
      path: file.path,
      references: linkItems
        .filter((item) => item.target === publicTarget)
        .flatMap((item) => item.occurrences),
      reviewStatus: "pending",
      sha256: file.sha256,
    };
  });

  const [cvHead, cvTree, contentHead, contentTree] = await Promise.all([
    gitLine(options.legacyCvRoot, ["rev-parse", "HEAD"]),
    gitLine(options.legacyCvRoot, ["rev-parse", "HEAD^{tree}"]),
    gitLine(options.contentRoot, ["rev-parse", "HEAD"]),
    gitLine(options.contentRoot, ["rev-parse", "HEAD^{tree}"]),
  ]);
  const relevantTreeListing = await git(options.legacyCvRoot, [
    "ls-tree",
    "-r",
    "--full-tree",
    "HEAD",
    "--",
    ...legacyCodePaths,
  ]);
  const cvPackage = JSON.parse(
    await readFile(join(options.legacyCvRoot, "package.json"), "utf8"),
  ) as { packageManager?: string };
  const contentPackage = JSON.parse(
    await readFile(join(options.contentRoot, "package.json"), "utf8"),
  ) as { packageManager?: string };
  const manifestJson = json(manifest);
  const stubFiles = contentFiles.filter(
    (file) =>
      file.bytes === 23 &&
      file.path.startsWith(`${contentDir}/profiles/`) &&
      file.extension === ".mdx",
  );
  const safeTextItems = textItems.map(
    ({ occurrences, value: _value, ...item }) => ({
      ...item,
      locales: [...new Set(occurrences.map(({ locale }) => locale))].sort(),
      occurrenceCount: occurrences.length,
      profiles: [...new Set(occurrences.map(({ profile }) => profile))].sort(),
    }),
  );
  const safeLinkItems = linkItems.map(
    ({ occurrences, target: _target, ...item }) => ({
      ...item,
      locales: [...new Set(occurrences.map(({ locale }) => locale))].sort(),
      occurrenceCount: occurrences.length,
      profiles: [...new Set(occurrences.map(({ profile }) => profile))].sort(),
    }),
  );
  const safeVariableItems = variableItems.map(
    ({ sourceValue: _sourceValue, occurrences, ...item }) => ({
      ...item,
      descriptorKinds: [
        ...new Set(occurrences.map(({ descriptor }) => descriptor.kind)),
      ].sort(),
      locales: [...new Set(occurrences.map(({ locale }) => locale))].sort(),
      occurrenceCount: occurrences.length,
      profiles: [...new Set(occurrences.map(({ profile }) => profile))].sort(),
    }),
  );
  const safeLock = {
    composition: {
      composedManifestSha256: sha256(manifestJson),
      contentSchema: manifest.contentSchema,
      entryCount: profileEntries.length,
      linkOccurrenceCount: links.length,
      linkTargetCount: linkItems.length,
      locales: [...manifest.locales].sort(),
      profileEntries,
      profiles: [...manifest.profiles].sort(),
      schema: manifest.schema,
      textItemCount: textItems.length,
      textOccurrenceCount: texts.length,
      variableOccurrenceCount: variableOccurrences.length,
    },
    inventory: {
      assets: assetItems,
      links: safeLinkItems,
      profileSources,
      texts: safeTextItems,
      variables: safeVariableItems,
    },
    schema: "legacy-cv-source-lock.v1",
    sources: {
      cv: {
        bunLockSha256: sha256(
          new Uint8Array(
            await Bun.file(
              join(options.legacyCvRoot, "bun.lock"),
            ).arrayBuffer(),
          ),
        ),
        commit: cvHead,
        legacyCodePaths,
        legacyCodeTreeSha256: sha256(relevantTreeListing),
        packageManager: cvPackage.packageManager ?? null,
        tree: cvTree,
      },
      cvContent: {
        bunLockSha256: sha256(
          new Uint8Array(
            await Bun.file(join(options.contentRoot, "bun.lock")).arrayBuffer(),
          ),
        ),
        commit: contentHead,
        config: sourceRepository.config,
        extensionCounts: countsBy(contentFiles, (file) => file.extension),
        packageManager: contentPackage.packageManager ?? null,
        sourceFileCount: contentFiles.filter((file) =>
          file.path.startsWith(`${contentDir}/`),
        ).length,
        stubMdxFileCount: stubFiles.length,
        trackedFileCount: contentFiles.length,
        trackedFilesSha256: sha256(json(contentFiles)),
        tree: contentTree,
        variableNames,
      },
      runtime: {
        bun: Bun.version,
      },
    },
  };
  const safeLockJson = await formattedJson(safeLock);
  const privateLedger = {
    assets: assetItems,
    instructions: {
      allowedDispositions: [
        "trusted-fact",
        "approved-preset",
        "renderer-copy",
        "ordering-or-emphasis",
        "drop",
      ],
      note: "Human review must set disposition for every item before the facts-only rewrite replaces cv-content.",
    },
    links: linkItems,
    profileSources,
    schema: "legacy-cv-migration-ledger.v1",
    source: {
      cvCommit: cvHead,
      cvContentCommit: contentHead,
      composedManifestSha256: sha256(manifestJson),
    },
    texts: textItems,
    variables: variableItems,
  };

  if (options.verifyLock) {
    const expected = await readFile(trackedLockPath, "utf8");

    if (expected !== safeLockJson) {
      throw new Error(
        `Legacy source lock mismatch. Re-run with --write-lock only after reviewing the source changes.`,
      );
    }
  }

  if (options.writeLock) {
    await writeFile(trackedLockPath, safeLockJson);
  }

  const stagingRoot = await prepareOutput(options.outputRoot);

  try {
    await Promise.all([
      writeFile(join(stagingRoot, "composed-profiles.json"), manifestJson),
      writeFile(join(stagingRoot, "legacy-source.lock.json"), safeLockJson),
      writeFile(
        join(stagingRoot, "migration-ledger.json"),
        json(privateLedger),
      ),
      copyTrackedTree(
        options.contentRoot,
        contentFiles,
        join(stagingRoot, "source-tree"),
      ),
    ]);

    const outputFiles: string[] = [];
    const visit = async (directory: string, prefix = ""): Promise<void> => {
      const entries = await readdir(directory, { withFileTypes: true });

      for (const entry of entries.sort((left, right) =>
        left.name.localeCompare(right.name),
      )) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          await visit(join(directory, entry.name), path);
        } else if (entry.isFile()) {
          outputFiles.push(path);
        }
      }
    };

    await visit(stagingRoot);
    const checksums = (
      await Promise.all(
        outputFiles
          .filter((path) => path !== "CHECKSUMS.sha256")
          .sort()
          .map(async (path) => {
            const bytes = new Uint8Array(
              await Bun.file(join(stagingRoot, path)).arrayBuffer(),
            );
            return `${sha256(bytes)}  ${path}`;
          }),
      )
    ).join("\n");
    await writeFile(join(stagingRoot, "CHECKSUMS.sha256"), `${checksums}\n`);
    await finishOutput(stagingRoot, options.outputRoot);
  } catch (error) {
    await rm(stagingRoot, { force: true, recursive: true });
    throw error;
  }

  console.log(
    json({
      assets: assetItems.length,
      composedManifestSha256: sha256(manifestJson),
      contentCommit: contentHead,
      entries: profileEntries.length,
      legacyCvCommit: cvHead,
      links: linkItems.length,
      output: options.outputRoot,
      texts: textItems.length,
      variables: variableItems.length,
    }).trim(),
  );
};

await main();
