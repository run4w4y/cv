# Internal charts

Small, accessible React charts for internal management applications. The
package deliberately uses responsive SVG instead of shipping a general-purpose
chart runtime. Its public surface covers the application-registry analytics
needs: timelines, categorical bars, and segmented rings/donuts.

Import the chart token contract after the internal UI theme:

```css
@import "tailwindcss";
@import "@cv/internal-ui/theme.css";
@import "@cv/internal-charts/theme.css";
```

```tsx
import { TimelineChart } from '@cv/internal-charts'

<TimelineChart
  ariaLabel="CV views over time"
  data={dailyViews}
  description="Daily views for the selected period."
  series={[{ dataKey: 'views', label: 'Views', area: true }]}
/>
```

Every chart renders an SVG title and description, keyboard-focusable data
marks, and a visually hidden data table. Consumers provide human-facing labels
and may override number and date formatters. Empty datasets render a shared
empty state rather than an invalid SVG.

## Public components

- `TimelineChart`: one or more line series, with optional area fills.
- `BarChart`: a single categorical value series.
- `DonutChart` / `RingChart`: a segmented outcome distribution.
- `ChartLegend`, `ChartDataTable`, and `ChartEmptyState`: reusable chart chrome.

## Storybook and checks

```sh
nx run internal-charts:storybook:dev
nx run internal-charts:typecheck
nx run internal-charts:test:unit
```

See [ATTRIBUTION.md](./ATTRIBUTION.md) for the Bklit UI source attribution.
