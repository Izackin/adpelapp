// Edge Function interna: entrega push somente ao recipient_id da app_notification.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import * as webPush from "https://esm.sh/web-push@3.6.7";
import {
  buildPushPayload,
  deliverToSubscriptions,
  WEBHOOK_BODY_MAX_BYTES,
  validateWebhookPayload,
} from "./logic.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";

if (!supabaseUrl || !supabaseServiceKey || !vapidPublic || !vapidPrivate) {
  throw new Error("Variáveis obrigatórias da Edge Function não estão configuradas.");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

webPush.setVapidDetails("mailto:admin@adpel.com", vapidPublic, vapidPrivate);

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  const webhookSecret = request.headers.get("x-adpel-webhook-secret")?.trim() ?? "";
  if (webhookSecret.length < 32 || webhookSecret.length > 256) {
    return jsonResponse({ error: "Webhook não autorizado." }, 401);
  }

  const { data: isAuthorized, error: authorizationError } = await supabaseAdmin
    .rpc("verify_notification_webhook_secret", { provided_secret: webhookSecret });

  if (authorizationError || isAuthorized !== true) {
    if (authorizationError) console.error("Falha ao validar o webhook.");
    return jsonResponse({ error: "Webhook não autorizado." }, 401);
  }

  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > WEBHOOK_BODY_MAX_BYTES) {
    return jsonResponse({ error: "Payload muito grande." }, 413);
  }

  let notificationId: string;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > WEBHOOK_BODY_MAX_BYTES) {
      return jsonResponse({ error: "Payload muito grande." }, 413);
    }
    notificationId = validateWebhookPayload(JSON.parse(rawBody));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payload inválido.";
    return jsonResponse({ error: message }, 400);
  }

  // O restante do payload não é confiável: a fonte canônica é consultada pelo ID.
  const { data: notification, error: notificationError } = await supabaseAdmin
    .from("app_notifications")
    .select("id, recipient_id, type, title, body, entity_type, entity_id, url")
    .eq("id", notificationId)
    .maybeSingle();

  if (notificationError) {
    console.error("Falha ao carregar a notificação canônica.");
    return jsonResponse({ error: "Não foi possível processar a notificação." }, 500);
  }
  if (!notification) {
    return jsonResponse({ success: true, ignored: true, reason: "notification_not_found" });
  }

  const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", notification.recipient_id);

  if (subscriptionsError) {
    console.error("Falha ao carregar as inscrições push do destinatário.");
    return jsonResponse({ error: "Não foi possível enviar a notificação." }, 500);
  }

  const result = await deliverToSubscriptions(
    subscriptions ?? [],
    buildPushPayload(notification),
    async (subscription, payloadText) => {
      await webPush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, payloadText);
    },
    async (endpoint) => {
      const { error } = await supabaseAdmin
        .from("push_subscriptions")
        .delete()
        .eq("endpoint", endpoint)
        .eq("user_id", notification.recipient_id);
      if (error) throw error;
    },
  );

  return jsonResponse({ success: true, ...result });
});
