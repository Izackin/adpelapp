import {
  SafeError,
  adminClient,
  errorResponse,
  jsonResponse,
  renewWatch,
} from "../_shared/google-calendar.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);
  try {
    const supplied = req.headers.get("x-adpel-cron-secret") || "";
    const { data: authorized, error: authError } = await adminClient.rpc(
      "verify_google_calendar_cron_secret",
      { provided_secret: supplied },
    );
    if (authError || authorized !== true) {
      throw new SafeError("Não autorizado.", 401);
    }
    const limit = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await adminClient.from("calendar_integrations")
      .select("*")
      .eq("provider", "google")
      .eq("status", "active")
      .not("calendar_id", "is", null)
      .or(`watch_expires_at.is.null,watch_expires_at.lt.${limit}`)
      .limit(50);
    if (error) throw new SafeError("Não foi possível consultar os canais.", 500);

    let renewed = 0;
    let failed = 0;
    for (const integration of data || []) {
      try {
        await renewWatch(integration);
        renewed += 1;
      } catch (_) {
        failed += 1;
        await adminClient.from("calendar_integrations").update({
          status: "error",
          last_error: "Não foi possível renovar o canal do Google Calendar.",
        }).eq("id", integration.id);
      }
    }
    return jsonResponse({ checked: data?.length || 0, renewed, failed });
  } catch (error) {
    return errorResponse(error);
  }
});
