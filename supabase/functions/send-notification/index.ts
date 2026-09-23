// Edge Function: send-notification
// Envia push global somente quando o chamador autenticado possui profiles.role = 'master'.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import * as webPush from "https://esm.sh/web-push@3.6.7";

const TITLE_MAX_LENGTH = 120;
const BODY_MAX_LENGTH = 1000;
const URL_MAX_LENGTH = 2048;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";

if (!supabaseUrl || !supabaseServiceKey || !vapidPublic || !vapidPrivate) {
  throw new Error(
    "Variáveis obrigatórias da Edge Function não estão configuradas.",
  );
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

webPush.setVapidDetails(
  "mailto:admin@adpel.com",
  vapidPublic,
  vapidPrivate,
);

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function validateTextField(
  value: unknown,
  fieldName: string,
  maxLength: number,
) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} é obrigatório.`);
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new Error(`${fieldName} deve ter no máximo ${maxLength} caracteres.`);
  }

  return normalized;
}

function validateNotificationUrl(value: unknown) {
  if (value === undefined || value === null || value === "") return "/";
  if (typeof value !== "string") throw new Error("URL inválida.");

  const normalized = value.trim();
  if (!normalized || normalized.length > URL_MAX_LENGTH) {
    throw new Error(`URL deve ter no máximo ${URL_MAX_LENGTH} caracteres.`);
  }

  if (normalized.startsWith("/") && !normalized.startsWith("//")) {
    try {
      new URL(normalized, "https://adpel.invalid");
      return normalized;
    } catch {
      throw new Error("URL inválida.");
    }
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      throw new Error("URL inválida.");
    }
    return parsed.toString();
  } catch {
    throw new Error("URL inválida.");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() ?? "";

  if (!token) {
    return jsonResponse({ error: "Autenticação obrigatória." }, 401);
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(
    token,
  );
  const user = authData.user;

  if (authError || !user) {
    return jsonResponse({ error: "Autenticação inválida." }, 401);
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error(
      "Falha ao verificar autorização do usuário:",
      profileError.message,
    );
    return jsonResponse(
      { error: "Não foi possível verificar a autorização." },
      500,
    );
  }

  if (!profile || profile.role !== "master") {
    return jsonResponse({ error: "Acesso negado." }, 403);
  }

  let requestBody: Record<string, unknown>;
  try {
    const parsedBody: unknown = await req.json();
    if (
      !parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)
    ) {
      throw new Error("Corpo da requisição inválido.");
    }
    requestBody = parsedBody as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: "Corpo da requisição inválido." }, 400);
  }

  let title: string;
  let body: string;
  let url: string;

  try {
    title = validateTextField(requestBody.title, "Título", TITLE_MAX_LENGTH);
    body = validateTextField(requestBody.body, "Mensagem", BODY_MAX_LENGTH);
    url = validateNotificationUrl(requestBody.url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dados inválidos.";
    return jsonResponse({ error: message }, 400);
  }

  const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth");

  if (subscriptionsError) {
    console.error(
      "Falha ao carregar inscrições push:",
      subscriptionsError.message,
    );
    return jsonResponse(
      { error: "Não foi possível enviar as notificações." },
      500,
    );
  }

  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const subscription of subscriptions ?? []) {
    try {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify({ title, body, url }),
      );
      sent++;
    } catch (error: any) {
      failed++;
      console.error(
        "Falha ao enviar uma notificação push:",
        error?.message ?? String(error),
      );

      if (error?.statusCode === 404 || error?.statusCode === 410) {
        const { error: deleteError } = await supabaseAdmin
          .from("push_subscriptions")
          .delete()
          .eq("endpoint", subscription.endpoint);

        if (!deleteError) removed++;
      }
    }
  }

  return jsonResponse({ success: true, sent, failed, removed });
});
