import { sendEmail } from "@/lib/email"

interface QueuedEmail {
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
  id: string
  status: "pending" | "sent" | "failed"
  attempts: number
}

class EmailQueue {
  private queue: QueuedEmail[] = []
  private processing = false
  private results = { sent: 0, failed: 0 }

  queueEmail(params: { to: string; subject: string; html: string; text?: string; replyTo?: string }): string {
    const id = `eq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    this.queue.push({ ...params, id, status: "pending", attempts: 0 })

    if (!this.processing) {
      this.processQueue()
    }

    return id
  }

  queueBulkEmails(emails: { to: string; subject: string; html: string; text?: string; replyTo?: string }[]): { queued: number } {
    for (const email of emails) {
      this.queueEmail(email)
    }
    return { queued: emails.length }
  }

  private async processQueue() {
    if (this.processing) return
    this.processing = true

    while (this.queue.some((e) => e.status === "pending")) {
      const batch = this.queue.filter((e) => e.status === "pending").slice(0, 10)

      for (const email of batch) {
        try {
          const result = await sendEmail({
            to: email.to,
            subject: email.subject,
            html: email.html,
            text: email.text,
          })

          if (result.success) {
            email.status = "sent"
            this.results.sent++
          } else {
            email.attempts++
            if (email.attempts >= 3) {
              email.status = "failed"
              this.results.failed++
            }
          }
        } catch {
          email.attempts++
          if (email.attempts >= 3) {
            email.status = "failed"
            this.results.failed++
          }
        }
      }

      // 1 second delay between batches
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    this.processing = false
  }

  getStatus() {
    return {
      pending: this.queue.filter((e) => e.status === "pending").length,
      sent: this.results.sent,
      failed: this.results.failed,
      processing: this.processing,
    }
  }
}

export const emailQueue = new EmailQueue()

export function replaceMergeTags(
  template: string,
  data: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] || match
  })
}
