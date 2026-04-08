import { LoadingSpinner } from "./LoadingSpinner"

interface PageLoadingProps {
  text?: string
}

export function PageLoading({ text }: PageLoadingProps) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center page-enter">
      <div className="text-center space-y-4">
        <div className="mx-auto w-8 h-8 animate-pulse text-primary opacity-40">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
        </div>
        <LoadingSpinner size="md" />
        {text && <p className="text-sm text-muted-foreground animate-pulse">{text}</p>}
      </div>
    </div>
  )
}
