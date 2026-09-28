import {
  SafeError,
  corsHeaders,
  disconnectGoogleCalendar,
  errorResponse,
  getIntegrationForUser,
  jsonResponse,
  listGoogleCalendars,
  requireMaster,
  safeIntegration,
  selectGoogleCalendar,
  startWatch,
  syncGoogleCalendar,
} from "../_shared/google-calendar.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);
  try {
    const user = await requireMaster(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "status";
    const integration = await getIntegrationForUser(user.id);

    if (action === "status") return jsonResponse({ integration: safeIntegration(integration) });
    if (!integration || integration.status === "disconnected") {
      throw new SafeError("Conecte sua conta Google primeiro.", 400);
    }
    if (action === "list_calendars") {
      return jsonResponse({ integration: safeIntegration(integration), calendars: await listGoogleCalendars(user.id) });
    }
    if (action === "select_calendar") {
      return jsonResponse(await selectGoogleCalendar(user.id, String(body.calendar_id || "")));
    }
    if (action === "sync") {
      const sync = await syncGoogleCalendar(integration);
      const current = await getIntegrationForUser(user.id);
      if (!current.watch_channel_id || !current.watch_expires_at || Date.parse(current.watch_expires_at) < Date.now()) {
        await startWatch(current);
      }
      return jsonResponse({ integration: safeIntegration(await getIntegrationForUser(user.id)), sync });
    }
    if (action === "disconnect") {
      return jsonResponse({ integration: await disconnectGoogleCalendar(user.id) });
    }
    throw new SafeError("Ação inválida.", 400);
  } catch (error) {
    return errorResponse(error);
  }
});
