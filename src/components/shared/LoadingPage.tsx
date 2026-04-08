import { LoadingSpinner } from "./LoadingSpinner"

export function LoadingPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 page-enter" role="status" aria-label="Loading">
      <div className="text-xl font-bold text-primary animate-pulse">EventFlow</div>
      <LoadingSpinner size="md" />
      <span className="sr-only">Loading...</span>
    </div>
  )
}
