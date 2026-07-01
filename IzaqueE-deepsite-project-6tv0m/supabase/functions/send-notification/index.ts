// Edge Function: send-notification
// Envia push para todas as inscrições usando web-push

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import webPush from "https://esm.sh/web-push@3.6.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";

if (!vapidPublic || !vapidPrivate) {
  throw new Error("VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY são obrigatórias nas env vars.");
}

webPush.setVapidDetails(
  "mailto:admin@adpel.com",
  vapidPublic,
  vapidPrivate
);

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error("Autenticação inválida.");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "master") {
      throw new Error("Acesso restrito ao master.");
    }

    const { title, body, url } = await req.json();
    if (!title || !body) throw new Error("Título e mensagem são obrigatórios.");

    const { data: subs, error: subsErr } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth");

    if (subsErr) throw subsErr;

    let sent = 0;
    let removed = 0;

    for (const sub of (subs ?? [])) {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
          },
          JSON.stringify({ title, body, url: url || "/" })
        );
        sent++;
      } catch (e: any) {
        console.error("Falha ao enviar push:", e.message);
        if (e.statusCode === 410 || e.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          removed++;
        }
      }
    }

    return new Response(JSON.stringify({ success: true, sent, removed }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
});