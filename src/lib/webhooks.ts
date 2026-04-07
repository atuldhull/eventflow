import crypto from "crypto"
import prisma from "@/lib/prisma"

export function signWebhookPayload(payload: string, secret: string, timestamp: string): string {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex")
}

export async function deliverWebhook(
  eventType: string,
  data: Record<string, unknown>,
  context: { organizationId?: string; enterpriseId?: string }
) {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: {
      isActive: true,
      events: { has: eventType },
      ...(context.organizationId ? { organizationId: context.organizationId } : {}),
      ...(context.enterpriseId ? { enterpriseId: context.enterpriseId } : {}),
    },
  })

  for (const endpoint of endpoints) {
    // Fire and forget
    sendWebhookDelivery(endpoint, eventType, data).catch((err) =>
      console.error(`Webhook delivery failed for ${endpoint.url}:`, err)
    )
  }
}

async function sendWebhookDelivery(
  endpoint: { id: string; url: string; secret: string },
  eventType: string,
  data: Record<string, unknown>
) {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const payload = {
    id: `del_${crypto.randomUUID().slice(0, 12)}`,
    event: eventType,
    timestamp: new Date().toISOString(),
    data,
    api_version: "v1",
  }

  const payloadString = JSON.stringify(payload)
  const signature = signWebhookPayload(payloadString, endpoint.secret, timestamp)

  const delivery = await prisma.webhookDelivery.create({
    data: {
      endpointId: endpoint.id,
      event: eventType,
      payload: payload as any,
      status: "pending",
    },
  })

  const startTime = Date.now()

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-EventFlow-Event": eventType,
        "X-EventFlow-Delivery": delivery.id,
        "X-EventFlow-Signature": signature,
        "X-EventFlow-Timestamp": timestamp,
      },
      body: payloadString,
      signal: controller.signal,
    })

    clearTimeout(timeout)
    const duration = Date.now() - startTime
    const responseBody = await response.text().catch(() => "")

    if (response.ok) {
      await prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: "success", responseStatus: response.status, responseBody, duration, attempts: 1 },
      })
      await prisma.webhookEndpoint.update({
        where: { id: endpoint.id },
        data: { lastDeliveredAt: new Date(), failureCount: 0 },
      })
    } else {
      await handleDeliveryFailure(delivery.id, endpoint.id, response.status, responseBody, duration)
    }
  } catch (error) {
    const duration = Date.now() - startTime
    await handleDeliveryFailure(delivery.id, endpoint.id, 0, String(error), duration)
  }
}

async function handleDeliveryFailure(
  deliveryId: string,
  endpointId: string,
  status: number,
  body: string,
  duration: number
) {
  const delivery = await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: "failed",
      responseStatus: status || null,
      responseBody: body.slice(0, 1000),
      duration,
      attempts: { increment: 1 },
    },
  })

  const endpoint = await prisma.webhookEndpoint.update({
    where: { id: endpointId },
    data: { failureCount: { increment: 1 }, lastFailedAt: new Date() },
  })

  // Disable after 5 consecutive failures
  if (endpoint.failureCount >= 5) {
    await prisma.webhookEndpoint.update({
      where: { id: endpointId },
      data: { isActive: false },
    })
  }
}

export async function createWebhookEndpoint(params: {
  url: string
  events: string[]
  description?: string
  organizationId?: string
  enterpriseId?: string
  createdById: string
}) {
  const secret = "whsec_" + crypto.randomBytes(32).toString("hex").slice(0, 32)

  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      url: params.url,
      events: params.events,
      description: params.description,
      organizationId: params.organizationId,
      enterpriseId: params.enterpriseId,
      createdById: params.createdById,
      secret,
    },
  })

  return { ...endpoint, secret }
}
