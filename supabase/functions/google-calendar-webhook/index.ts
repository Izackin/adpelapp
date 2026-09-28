import {
  adminClient,
  getIntegrationById,
  sha256,
  syncGoogleCalendar,
} from "../_shared/google-calendar.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(null, { status: 405 });
  const channelId = req.headers.get("x-goog-channel-id") || "";
  const resourceId = req.headers.get("x-goog-resource-id") || "";
  const channelToken = req.headers.get("x-goog-channel-token") || "";
  const resourceState = req.headers.get("x-goog-resource-state") || "";
  if (!channelId || !resourceId || !channelToken) return new Response(null, { status: 401 });

  const { data: integration } = await adminClient.from("calendar_integrations")
    .select("id, watch_token_hash, status")
    .eq("watch_channel_id", channelId)
    .eq("watch_resource_id", resourceId)
    .maybeSingle();
  if (!integration || integration.status !== "active") return new Response(null, { status: 404 });
  if (await sha256(channelToken) !== integration.watch_token_hash) return new Response(null, { status: 401 });
  if (!["sync", "exists", "not_exists"].includes(resourceState)) return new Response(null, { status: 204 });

  EdgeRuntime.waitUntil(
    getIntegrationById(integration.id)
      .then((current) => syncGoogleCalendar(current))
      .catch(() => undefined),
  );
  return new Response(null, { status: 204 });
});
