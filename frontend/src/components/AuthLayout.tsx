export const AuthLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-6">
    <div className="mb-5 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Alumni Bidding</h1>
      <p className="text-sm text-slate-600">University Analytics Client</p>
    </div>
    {children}
  </div>
)
