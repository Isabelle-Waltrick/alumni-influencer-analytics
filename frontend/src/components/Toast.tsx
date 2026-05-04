// ─────────────────────────────────────────────────────────────────────────────
// components/Toast.tsx — Floating error notification
//
// Renders a small red banner in the top-right corner of the screen whenever
// an error occurs (e.g. failed API call, login failure). It disappears
// automatically after 3.5 seconds — that timer is managed in App.tsx,
// not here. This component is purely responsible for showing the message.
// ─────────────────────────────────────────────────────────────────────────────

import type { ToastState } from '../types'

// The component receives the current toast state from App.tsx.
// If toast is null, nothing is rendered (the notification is hidden).
export const Toast = ({ toast }: { toast: ToastState }) => {
  // null means "no notification to show right now" — render nothing.
  if (!toast) return null

  return (
    // fixed + top-4 + right-4 pins it to the top-right of the screen,
    // z-50 ensures it floats above all other content.
    <div className="fixed right-4 top-4 z-50 max-w-sm rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg">
      {toast.message}
    </div>
  )
}
