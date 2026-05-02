import type { ToastState } from '../types'

export const Toast = ({ toast }: { toast: ToastState }) => {
  if (!toast) return null
  return (
    <div className="fixed right-4 top-4 z-50 max-w-sm rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-lg">
      {toast.message}
    </div>
  )
}
