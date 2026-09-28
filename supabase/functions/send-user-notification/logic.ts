export const TITLE_MAX_LENGTH = 120;
export const BODY_MAX_LENGTH = 1000;
export const WEBHOOK_BODY_MAX_BYTES = 32 * 1024;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AppNotification = {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  url: string | null;
};

export type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type WebhookEnvelope = {
  type?: unknown;
  schema?: unknown;
  table?: unknown;
  record?: unknown;
};

export function validateWebhookPayload(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Payload do webhook inválido.");
  }

  const envelope = payload as WebhookEnvelope;
  if (
    envelope.type !== "INSERT" ||
    envelope.schema !== "public" ||
    envelope.table !== "app_notifications"
  ) {
    throw new Error("Origem do webhook inválida.");
  }

  if (
    !envelope.record ||
    typeof envelope.record !== "object" ||
    Array.isArray(envelope.record)
  ) {
    throw new Error("Registro do webhook inválido.");
  }

  const notificationId = (envelope.record as Record<string, unknown>).id;
  if (typeof notificationId !== "string" || !UUID_PATTERN.test(notificationId)) {
    throw new Error("ID da notificação inválido.");
  }

  return notificationId;
}

export function notificationTargetUrl(notification: AppNotification): string {
  if (
    notification.entity_type === "community_post" &&
    notification.entity_id &&
    UUID_PATTERN.test(notification.entity_id)
  ) {
    return `/index.html?notification_post=${encodeURIComponent(notification.entity_id)}#community`;
  }

  const candidate = notification.url?.trim() ?? "";
  if (candidate.startsWith("/") && !candidate.startsWith("//")) {
    return candidate;
  }
  if (candidate.startsWith("#")) {
    return `/index.html${candidate}`;
  }
  return "/index.html";
}

export function buildPushPayload(notification: AppNotification) {
  return {
    title: notification.title.trim().slice(0, TITLE_MAX_LENGTH) || "ADPEL",
    body: (notification.body ?? "Você recebeu uma nova notificação.")
      .trim()
      .slice(0, BODY_MAX_LENGTH),
    url: notificationTargetUrl(notification),
    notification_id: notification.id,
    type: notification.type,
    entity_type: notification.entity_type,
    entity_id: notification.entity_id,
  };
}

export function isExpiredPushError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return statusCode === 404 || statusCode === 410;
}

export async function deliverToSubscriptions(
  subscriptions: PushSubscriptionRow[],
  payload: Record<string, unknown>,
  send: (subscription: PushSubscriptionRow, payloadText: string) => Promise<void>,
  remove: (endpoint: string) => Promise<void>,
) {
  let sent = 0;
  let failed = 0;
  let removed = 0;
  const payloadText = JSON.stringify(payload);

  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await send(subscription, payloadText);
      sent += 1;
    } catch (error) {
      failed += 1;
      if (isExpiredPushError(error)) {
        try {
          await remove(subscription.endpoint);
          removed += 1;
        } catch {
          // A falha de limpeza não deve interromper as demais entregas.
        }
      }
    }
  }));

  return { sent, failed, removed };
}
