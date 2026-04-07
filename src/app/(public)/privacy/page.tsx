import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Privacy Policy | EventFlow",
  description: "EventFlow privacy policy — how we collect, use, and protect your data.",
}

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mt-2">Last updated: April 2026</p>
      <div className="prose prose-zinc dark:prose-invert mt-8">
        <h2>1. Information We Collect</h2>
        <p>We collect information you provide directly, including your name, email, phone number, and any information you submit through registration forms.</p>
        <h2>2. How We Use Your Information</h2>
        <p>We use your information to provide our services, process event registrations, send notifications, and improve the platform.</p>
        <h2>3. Data Sharing</h2>
        <p>We share your registration data with event organizers for the events you register for. We do not sell your personal data to third parties.</p>
        <h2>4. Data Security</h2>
        <p>We implement industry-standard security measures to protect your data, including encryption in transit and at rest.</p>
        <h2>5. Cookies</h2>
        <p>We use essential cookies for authentication and preferences. We do not use tracking cookies without your consent.</p>
        <h2>6. Your Rights</h2>
        <p>You have the right to access, update, or delete your personal data. Contact us at privacy@eventflow.com for any data-related requests.</p>
        <h2>7. Contact</h2>
        <p>For privacy-related questions, email us at privacy@eventflow.com.</p>
      </div>
    </div>
  )
}
