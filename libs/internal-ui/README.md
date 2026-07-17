# Internal management UI

Reusable React primitives for management applications in this workspace. The
package follows shadcn-style composition and styling while using Base UI for
interactive behavior. It deliberately owns presentation primitives and shell
building blocks, not application-specific data tables or business workflows.

Import the shared Tailwind v4 token contract once in an application's global
stylesheet:

```css
@import "tailwindcss";
@import "shadcn/tailwind.css";
@import "@cv/internal-ui/theme.css";
```

The public API includes:

- Actions and forms: button, button group, input, input group, textarea, label,
  field, checkbox, switch, radio group, and select.
- Date and time: single and range calendars, date and date-range pickers,
  locale-aware segmented inputs, date-time inputs, and date-time range inputs.
- Overlays: popover, dropdown menu, tooltip, dialog, alert dialog, and sheet.
- Navigation: responsive sidebar and breadcrumbs.
- Surfaces and feedback: card, alert, empty state, skeleton, item, avatar, badge,
  badge overflow, separator, tabs, keyboard hints, and table markup.

`@cv/drizzle-query-ui` builds its metadata-driven filters on these primitives.
TanStack Table configuration and registry-specific table behavior remain in the
application, as intended.

## Storybook

Every public component has a colocated `*.stories.tsx` file. The preview loads
the package's actual Tailwind v4 theme and provides a light/dark toolbar toggle.

```sh
nx run internal-ui:storybook:dev
nx run internal-ui:storybook:build
```

Component tests follow the repository convention: they are colocated beside
the implementation and use the same basename, for example
`badge-overflow.tsx` and `badge-overflow.test.tsx`.
