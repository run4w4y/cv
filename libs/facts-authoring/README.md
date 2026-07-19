# `@cv/facts-authoring`

Code-owned schemas and deterministic composition for the human-authored facts
repository.

The content repository owns `facts.config.ts` and plain TypeScript modules below
the configured facts directory. Small sections are authored as `section.ts`;
larger sections expose `section/index.ts` and import entry modules from the same
directory. This package validates the typed identity, contact, education,
experience, projects, and skills sections, checks semantic locale parity, and
emits one hierarchical `cv.facts.v1` catalogue per authored locale.

Internal catalogue IDs are not part of the authoring surface. Composition adds
deterministic IDs from locale-normalized structural paths after source
validation. Evidence and asset registry keys remain explicit because facts may
actually reference them. Technology arrays are locale-invariant and must match
the default locale exactly.

Facts retain their domain context through entries, workstreams, project
contribution groups, and skill groups. Section and fact guidance controls what
generation workflows may select, paraphrase, summarize, or omit. There are no
generic role tags or duplicate wording presets.

It intentionally contains no profiles, inheritance, encryption, JSX, MDX, or
renderer components. Vite is only used by the checkout loader to evaluate the
external TypeScript source tree.
