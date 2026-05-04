// ─────────────────────────────────────────────────────────────────────────────
// components/AuthLayout.tsx — Wrapper for authentication pages
//
// Provides the shared visual frame used by the login, forgot-password, and
// reset-password pages. It centres its content vertically and horizontally,
// and adds the "Alumni Analytics" heading above the form card.
//
// The actual form is passed in as "children" (the content between the opening
// and closing <AuthLayout> tags in App.tsx).
// ─────────────────────────────────────────────────────────────────────────────

// children — React.ReactNode means "any valid JSX content": a component,
// a string, a list of elements, etc. The caller decides what goes inside.
export const AuthLayout = ({ children }: { children: React.ReactNode }) => (
  // Full-screen centred column with a light grey background.
  <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
    {/* Branding header above the form card */}
    <div className="mb-5 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Alumni Analytics</h1>
      <p className="text-sm text-slate-600">University Analytics Client</p>
    </div>
    {/* The actual form/page content is rendered here */}
    {children}
  </div>
)
