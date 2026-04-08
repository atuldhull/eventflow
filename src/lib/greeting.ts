export function getGreeting(name?: string | null): string {
  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const firstName = name?.split(" ")[0]
  return firstName ? `${timeGreeting}, ${firstName}` : timeGreeting
}
