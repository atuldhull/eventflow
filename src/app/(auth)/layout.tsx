export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-[55%] flex-col justify-between bg-zinc-950 p-12 text-white">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">EventFlow</h1>
        </div>
        <div className="space-y-4">
          <blockquote className="space-y-2">
            <p className="text-lg leading-relaxed text-zinc-300">
              Create events, manage registrations, process payments, scan QR tickets, and generate certificates — all in one platform.
            </p>
            <footer className="text-sm text-zinc-400">
              Built for universities, companies, and organizations
            </footer>
          </blockquote>
        </div>
        <p className="text-xs text-zinc-500">
          Professional Event Management Platform
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-[420px] space-y-6">
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-2xl font-bold">EventFlow</h1>
            <p className="text-sm text-muted-foreground mt-1">Event Management Platform</p>
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
