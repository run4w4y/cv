# @cv/content-types

Generator for portable content authoring declarations.

The tool reads an app-owned content schema module and authoring component module,
then writes a standalone `content-authoring.d.ts` file for the authored content
repository. The generated declarations expose `virtual:content` types without
depending on workspace internals.
