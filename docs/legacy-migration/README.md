# Completed legacy CV preservation snapshot

This directory is a read-only migration record for the profile-based CV that
preceded v2. The migration has already been materialized and reviewed; active
v2 development must not regenerate this snapshot from the current worktrees or
treat its inventory as a live content source.

The exact legacy sources are preserved by the annotated tags
`legacy-pages-source-2026-07-17` in this repository and
`legacy-profiles-2026-07-17` in the private `cv-content` repository. Their
peeled commits are also pinned in `legacy-source.lock.json`. The lock contains
hashes, counts, profile/source relationships, and migration item IDs, but it
deliberately does **not** contain authored text, link targets, or variable
values.

The ignored private bundle created during the migration contains:

- `composed-profiles.json`: every composed locale/profile document;
- `migration-ledger.json`: text, link, variable, asset, and source-layer items
  that awaited human review at snapshot time;
- `source-tree/`: a byte-for-byte copy of every tracked `cv-content` file;
- `legacy-source.lock.json`: the public-safe snapshot lock copied into the
  private bundle;
- `CHECKSUMS.sha256`: hashes for every materialized file.

The private output contains personal data and content that was previously
encrypted. Do not add it to Git or upload it as a public CI artifact. The
tracked lock is evidence, not an editable v2 backlog; `--write-lock` is retained
only for historical tooling completeness and must not be used during ordinary
v2 work.

## Audit reproduction

The active repositories no longer contain the legacy composer or profile tree,
so commands that rely on their current checkouts are intentionally invalid. If
an audit ever needs to reproduce the snapshot, create isolated worktrees from
the preservation tags, build the old packages there, and invoke the retained
script with both roots explicitly:

```sh
git -C /home/adachi/cv worktree add /tmp/cv-legacy legacy-pages-source-2026-07-17
git -C /home/adachi/cv-content worktree add /tmp/cv-content-legacy legacy-profiles-2026-07-17
zsh -ilc 'cd /tmp/cv-legacy && bun install --frozen-lockfile && bun nx run-many --target=build --projects=content-core,content-composer,private-content-crypto,private-content-protocol,content-build,content-astro'
zsh -ilc 'cd /home/adachi/cv && bun docs/legacy-migration/materialize.ts --legacy-cv-root /tmp/cv-legacy --content-root /tmp/cv-content-legacy --verify-lock'
```

Both worktrees must be clean. The script refuses to overwrite an arbitrary
output directory and writes private material only to the ignored
`docs/legacy-migration/private-output/` directory unless an explicit safe
output is supplied.

The source commits, Git tree IDs, package-manager versions, lockfile hashes,
content configuration, schema IDs, and relevant legacy-code tree hash are all
part of the tracked lock. This makes the snapshot independently auditable even
after the active v2 branch no longer contains the old implementation.
