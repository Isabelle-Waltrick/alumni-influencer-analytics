// ─────────────────────────────────────────────────────────────────────────────
// main.tsx — Application entry point
//
// This is the VERY FIRST file that runs when the browser loads the app.
// Its only job is to attach the React application to the HTML page.
//
// How it works:
//  1. Vite (the build tool) starts here and bundles all other files from this.
//  2. We grab the <div id="app"> element that lives in index.html.
//  3. We hand that element to ReactDOM, which "mounts" the app inside it —
//     from this point on, React controls everything inside that div.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'  // Enables client-side navigation (URL changes without full page reloads)
import App from './App'          // The root component that holds all pages and global state
import './index.css'             // Imports Tailwind CSS and any global base styles

// ReactDOM.createRoot().render() is the React 18 way of starting the app.
// The '!' after getElementById tells TypeScript "this element definitely exists".
ReactDOM.createRoot(document.getElementById('app')!).render(
  // React.StrictMode is a development helper — it runs each component twice
  // to catch side-effects and warns about outdated React patterns.
  // It has no effect in the final production build.
  <React.StrictMode>
    {/* BrowserRouter wraps the whole app so any component can use navigation
        hooks like useNavigate() and useLocation() from react-router-dom. */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
