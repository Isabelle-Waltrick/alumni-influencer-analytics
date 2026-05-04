// ─────────────────────────────────────────────────────────────────────────────
// lib/chartjs.ts — Chart.js component registration
//
// Chart.js uses a "tree-shakeable" design: you only bundle the chart types and
// plugins you actually use. Before you render any chart, you must register the
// pieces you need by calling ChartJS.register().
//
// This file does that registration ONCE. It is imported in App.tsx (the root)
// so it runs before any chart component tries to render.
// If you forget to register a component (e.g. RadialLinearScale for radar
// charts), Chart.js will throw an error at runtime.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ArcElement,          // Required for Pie and Doughnut charts (the arc/slice shape)
  BarElement,          // Required for Bar charts (the rectangular bar shape)
  CategoryScale,       // X-axis type for labelled categories (e.g. "2021", "2022")
  Chart as ChartJS,    // The main Chart.js class — we call .register() on this
  Filler,              // Fills the area under a line chart
  Legend,              // The chart legend (the colour key)
  LineElement,         // Required for Line charts (the line connecting points)
  LinearScale,         // Y-axis type for numeric scales
  PointElement,        // Required for Line charts (the dots on each data point)
  RadialLinearScale,   // Required for Radar charts (the spider-web style axes)
  Tooltip,             // The hover tooltip that shows values when you point at a chart
} from 'chart.js'

// Register all components in one call.
// After this line, react-chartjs-2 components like <Bar>, <Line>, <Pie> etc.
// will find everything they need and render correctly.
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  Filler,
  RadialLinearScale
)
