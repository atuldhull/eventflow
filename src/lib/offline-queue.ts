"use client"

const QUEUE_KEY = "eventflow_checkin_queue"

interface QueuedCheckIn {
  qrData: string
  eventId: string
  timestamp: number
  method: string
}

export function queueCheckIn(data: QueuedCheckIn): void {
  const queue = getQueue()
  queue.push(data)
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function getQueue(): QueuedCheckIn[] {
  try {
    const stored = localStorage.getItem(QUEUE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function getQueueSize(): number {
  return getQueue().length
}

export async function syncQueue(): Promise<{ success: number; failed: number }> {
  const queue = getQueue()
  if (queue.length === 0) return { success: 0, failed: 0 }

  let success = 0
  let failed = 0
  const remaining: QueuedCheckIn[] = []

  for (const item of queue) {
    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "QR_SCAN",
          qrData: item.qrData,
          eventId: item.eventId,
        }),
      })
      const data = await res.json()
      if (data.success || data.reason === "ALREADY_CHECKED_IN") {
        success++
      } else {
        failed++
        remaining.push(item)
      }
    } catch {
      failed++
      remaining.push(item)
    }
  }

  localStorage.setItem(QUEUE_KEY, JSON.stringify(remaining))
  return { success, failed }
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY)
}
