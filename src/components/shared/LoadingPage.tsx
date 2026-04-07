export function LoadingPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4" role="status" aria-label="Loading">
      <div className="text-xl font-bold text-primary animate-pulse">EventFlow</div>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      <span className="sr-only">Loading...</span>
    </div>
  )
}
