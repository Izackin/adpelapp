import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import {
  mapGoogleEvent,
  publicIntegration,
} from "./google-calendar-logic.mjs";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_API_URL = "https://www.googleapis.com/calendar/v3";
const ADPEL_SYNC_TIME_MIN = "2026-10-01T00:00:00-03:00";
const ADPEL_SYNC_TIME_MAX = "2027-01-01T00:00:00-03:00";

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new SafeError(`Configuração ausente: ${name}.`, 503);
  return value;
}

const supabaseUrl = requiredEnv("SUPABASE_URL");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

export const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export class SafeError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

class GoogleHttpError extends Error {
  status: number;
  constructor(status: number) {
    super(`Google Calendar respondeu com HTTP ${status}.`);
    this.status = status;
  }
}

export function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

export function errorResponse(error: unknown) {
  const safe = error instanceof SafeError
    ? error
    : new SafeError("Não foi possível concluir a operação do Google Calendar.", 500);
  return jsonResponse({ error: safe.message }, safe.status);
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((value) => binary += String.fromCharCode(value));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

export function randomSecret(size = 32) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return base64Url(new Uint8Array(digest));
}

async function requireUserToken(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new SafeError("Sessão obrigatória.", 401);
  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data.user) throw new SafeError("Sessão inválida ou expirada.", 401);
  return data.user;
}

export async function requireMaster(req: Request) {
  const user = await requireUserToken(req);
  const { data: profile, error } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (error || profile?.role !== "master") {
    throw new SafeError("Acesso restrito ao administrador Master.", 403);
  }
  return user;
}

export async function createOAuthAuthorization(userId: string) {
  const state = randomSecret(32);
  const codeVerifier = randomSecret(64);
  const [stateHash, codeChallenge] = await Promise.all([
    sha256(state),
    sha256(codeVerifier),
  ]);

  await adminClient.from("calendar_oauth_states").delete().lt("expires_at", new Date().toISOString());
  const { error } = await adminClient.from("calendar_oauth_states").insert({
    state_hash: stateHash,
    user_id: userId,
    code_verifier: codeVerifier,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (error) throw new SafeError("Não foi possível iniciar a autorização.", 500);

  const params = new URLSearchParams({
    client_id: requiredEnv("GOOGLE_CLIENT_ID"),
    redirect_uri: requiredEnv("GOOGLE_OAUTH_REDIRECT_URI"),
    response_type: "code",
    scope: GOOGLE_SCOPE,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function consumeOAuthState(rawState: string) {
  if (!rawState || rawState.length > 256) throw new SafeError("Estado OAuth inválido.", 400);
  const stateHash = await sha256(rawState);
  const now = new Date().toISOString();
  const { data, error } = await adminClient
    .from("calendar_oauth_states")
    .update({ used_at: now })
    .eq("state_hash", stateHash)
    .is("used_at", null)
    .gt("expires_at", now)
    .select("user_id, code_verifier")
    .maybeSingle();
  if (error || !data) throw new SafeError("Estado OAuth inválido, expirado ou já utilizado.", 400);
  return data;
}

async function tokenRequest(values: Record<string, string>) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
  });
  if (!response.ok) throw new SafeError("O Google recusou a autorização. Conecte novamente.", 401);
  return await response.json();
}

export async function exchangeAuthorizationCode(code: string, codeVerifier: string) {
  if (!code || code.length > 2048) throw new SafeError("Código OAuth inválido.", 400);
  return await tokenRequest({
    code,
    code_verifier: codeVerifier,
    client_id: requiredEnv("GOOGLE_CLIENT_ID"),
    client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
    redirect_uri: requiredEnv("GOOGLE_OAUTH_REDIRECT_URI"),
    grant_type: "authorization_code",
  });
}

export async function saveOAuthGrant(userId: string, grant: Record<string, unknown>) {
  const { data: existing, error: findError } = await adminClient
    .from("calendar_integrations")
    .select("id, calendar_id")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  if (findError) throw new SafeError("Não foi possível salvar a integração.", 500);

  let integrationId = existing?.id;
  if (existing) {
    const { error } = await adminClient.from("calendar_integrations").update({
      status: existing.calendar_id ? "active" : "connected",
      last_error: null,
    }).eq("id", existing.id);
    if (error) throw new SafeError("Não foi possível atualizar a integração.", 500);
  } else {
    const { data, error } = await adminClient.from("calendar_integrations").insert({
      user_id: userId,
      provider: "google",
      status: "connected",
    }).select("id").single();
    if (error) throw new SafeError("Não foi possível criar a integração.", 500);
    integrationId = data.id;
  }

  if (typeof grant.refresh_token === "string" && grant.refresh_token) {
    const { error } = await adminClient.rpc("set_google_calendar_refresh_token", {
      target_user_id: userId,
      new_refresh_token: grant.refresh_token,
    });
    if (error) throw new SafeError("Não foi possível proteger a credencial OAuth.", 500);
  } else {
    const { data: storedToken } = await adminClient.rpc("get_google_calendar_refresh_token", {
      target_user_id: userId,
    });
    if (!storedToken) throw new SafeError("O Google não forneceu acesso offline. Revogue o acesso e conecte novamente.", 400);
  }
  return integrationId;
}

async function accessTokenForUser(userId: string) {
  const { data: refreshToken, error } = await adminClient.rpc("get_google_calendar_refresh_token", {
    target_user_id: userId,
  });
  if (error || !refreshToken) throw new SafeError("Credencial do Google ausente. Conecte novamente.", 401);
  const grant = await tokenRequest({
    refresh_token: refreshToken,
    client_id: requiredEnv("GOOGLE_CLIENT_ID"),
    client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
    grant_type: "refresh_token",
  });
  if (!grant.access_token) throw new SafeError("O Google não renovou a autorização.", 401);
  return String(grant.access_token);
}

async function googleRequest(url: string, accessToken: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...init, headers });
  if (!response.ok) throw new GoogleHttpError(response.status);
  if (response.status === 204) return null;
  return await response.json();
}

export async function getIntegrationForUser(userId: string) {
  const { data, error } = await adminClient
    .from("calendar_integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  if (error) throw new SafeError("Não foi possível consultar a integração.", 500);
  return data;
}

export async function getIntegrationById(id: string) {
  const { data, error } = await adminClient
    .from("calendar_integrations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new SafeError("Integração não encontrada.", 404);
  return data;
}

export function safeIntegration(integration: unknown) {
  return publicIntegration(integration);
}

export async function listGoogleCalendars(userId: string) {
  const token = await accessTokenForUser(userId);
  const calendars = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({ maxResults: "250" });
    if (pageToken) params.set("pageToken", pageToken);
    const payload = await googleRequest(`${GOOGLE_API_URL}/users/me/calendarList?${params}`, token);
    for (const item of payload.items || []) {
      if (!item.id || item.deleted) continue;
      calendars.push({
        id: item.id,
        name: item.summaryOverride || item.summary || item.id,
        timezone: item.timeZone || "UTC",
        primary: item.primary === true,
        access_role: item.accessRole || "reader",
      });
    }
    pageToken = payload.nextPageToken || "";
  } while (pageToken);
  return calendars;
}

async function applyGoogleEvent(integration: Record<string, unknown>, mapped: Record<string, unknown>) {
  const calendarId = String(integration.calendar_id);
  const eventId = String(mapped.external_event_id);
  if (mapped.cancelled) {
    const { data, error } = await adminClient.from("events")
      .update({ is_active: false, is_published: false })
      .eq("source", "google")
      .eq("external_calendar_id", calendarId)
      .eq("external_event_id", eventId)
      .select("id");
    if (error) throw error;
    return { created: 0, updated: 0, deactivated: data?.length || 0, skipped: 0 };
  }

  const { data: existing, error: findError } = await adminClient.from("events")
    .select("id")
    .eq("source", "google")
    .eq("external_calendar_id", calendarId)
    .eq("external_event_id", eventId)
    .maybeSingle();
  if (findError) throw findError;

  const values = {
    title: mapped.title,
    description: mapped.description,
    location: mapped.location,
    event_date: mapped.event_date,
    event_time: mapped.event_time,
    end_date: mapped.end_date,
    end_time: mapped.end_time,
    source: "google",
    external_event_id: eventId,
    external_calendar_id: calendarId,
  };
  if (existing) {
    const { error } = await adminClient.from("events").update(values).eq("id", existing.id).eq("source", "google");
    if (error) throw error;
    return { created: 0, updated: 1, deactivated: 0, skipped: 0 };
  }

  const { error } = await adminClient.from("events").insert({
    ...values,
    category: "evento",
    is_active: true,
    is_published: true,
    is_featured: false,
  });
  if (error?.code === "23505") {
    const { error: retryError } = await adminClient.from("events").update(values)
      .eq("source", "google")
      .eq("external_calendar_id", calendarId)
      .eq("external_event_id", eventId);
    if (retryError) throw retryError;
    return { created: 0, updated: 1, deactivated: 0, skipped: 0 };
  }
  if (error) throw error;
  return { created: 1, updated: 0, deactivated: 0, skipped: 0 };
}

function addCounts(total: Record<string, number>, current: Record<string, number>) {
  for (const key of ["created", "updated", "deactivated", "skipped"]) total[key] += current[key] || 0;
}

async function deactivateMissing(calendarId: string, seen: Set<string>) {
  const { data, error } = await adminClient.from("events")
    .select("id, external_event_id, is_active, is_published")
    .eq("source", "google")
    .eq("external_calendar_id", calendarId);
  if (error) throw error;
  const missing = (data || []).filter((item) => !seen.has(item.external_event_id) && (item.is_active || item.is_published));
  for (let index = 0; index < missing.length; index += 100) {
    const ids = missing.slice(index, index + 100).map((item) => item.id);
    const { error: updateError } = await adminClient.from("events")
      .update({ is_active: false, is_published: false })
      .eq("source", "google")
      .in("id", ids);
    if (updateError) throw updateError;
  }
  return missing.length;
}

function publicSyncError(error: unknown) {
  if (error instanceof SafeError) return error;
  if (error instanceof GoogleHttpError) {
    if (error.status === 401 || error.status === 403) return new SafeError("A autorização do Google expirou ou não possui acesso ao calendário.", 401);
    if (error.status === 404) return new SafeError("O calendário selecionado não está mais disponível.", 404);
    if (error.status === 429) return new SafeError("Limite temporário do Google Calendar atingido. Tente novamente depois.", 429);
  }
  return new SafeError("Falha temporária ao sincronizar o Google Calendar.", 502);
}

export async function syncGoogleCalendar(integrationOrId: string | Record<string, unknown>, _forceFull = false) {
  const integration = typeof integrationOrId === "string"
    ? await getIntegrationById(integrationOrId)
    : integrationOrId;
  if (!integration.calendar_id) throw new SafeError("Selecione um calendário antes de sincronizar.", 400);

  try {
    const accessToken = await accessTokenForUser(String(integration.user_id));
    const counts = { created: 0, updated: 0, deactivated: 0, skipped: 0 };
    const seen = new Set<string>();
    let pageToken = "";

    do {
      const params = new URLSearchParams({
        maxResults: "2500",
        singleEvents: "true",
        showDeleted: "true",
        timeMin: ADPEL_SYNC_TIME_MIN,
        timeMax: ADPEL_SYNC_TIME_MAX,
      });
      if (pageToken) params.set("pageToken", pageToken);

      const endpoint = `${GOOGLE_API_URL}/calendars/${encodeURIComponent(String(integration.calendar_id))}/events?${params}`;
      const payload = await googleRequest(endpoint, accessToken);

      for (const item of payload.items || []) {
        if (item.id) seen.add(item.id);
        const mapped = mapGoogleEvent(item, integration.calendar_id, integration.calendar_timezone || "UTC");
        if (!mapped) {
          counts.skipped += 1;
          continue;
        }
        addCounts(counts, await applyGoogleEvent(integration, mapped));
      }

      pageToken = payload.nextPageToken || "";
    } while (pageToken);

    // O usuário optou por sincronizar somente outubro-dezembro de 2026.
    // Eventos Google fora dessa janela permanecem no histórico, porém inativos.
    counts.deactivated += await deactivateMissing(String(integration.calendar_id), seen);

    const finishedAt = new Date().toISOString();
    const { error: updateError } = await adminClient.from("calendar_integrations").update({
      sync_token: null,
      last_synced_at: finishedAt,
      last_error: null,
      status: "active",
    }).eq("id", integration.id);
    if (updateError) throw updateError;

    return {
      ...counts,
      full_sync: true,
      synced_at: finishedAt,
      window_start: "2026-10-01",
      window_end: "2026-12-31",
    };
  } catch (error) {
    const safe = publicSyncError(error);
    await adminClient.from("calendar_integrations").update({
      status: "error",
      last_error: safe.message.slice(0, 500),
    }).eq("id", integration.id);
    throw safe;
  }
}

export async function stopWatch(integration: Record<string, unknown>) {
  if (!integration.watch_channel_id || !integration.watch_resource_id) return;
  try {
    const accessToken = await accessTokenForUser(String(integration.user_id));
    await googleRequest(`${GOOGLE_API_URL}/channels/stop`, accessToken, {
      method: "POST",
      body: JSON.stringify({ id: integration.watch_channel_id, resourceId: integration.watch_resource_id }),
    });
  } catch (error) {
    if (!(error instanceof GoogleHttpError && (error.status === 404 || error.status === 410))) throw error;
  }
}

export async function startWatch(integrationOrId: string | Record<string, unknown>) {
  const integration = typeof integrationOrId === "string"
    ? await getIntegrationById(integrationOrId)
    : integrationOrId;
  if (!integration.calendar_id) throw new SafeError("Calendário não selecionado.", 400);
  const accessToken = await accessTokenForUser(String(integration.user_id));
  const channelId = crypto.randomUUID();
  const channelToken = randomSecret(32);
  const requestedExpiration = Date.now() + 6 * 24 * 60 * 60 * 1000;
  const payload = await googleRequest(
    `${GOOGLE_API_URL}/calendars/${encodeURIComponent(String(integration.calendar_id))}/events/watch`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        id: channelId,
        type: "web_hook",
        address: requiredEnv("GOOGLE_CALENDAR_WEBHOOK_URL"),
        token: channelToken,
        expiration: requestedExpiration,
      }),
    },
  );
  const expiresAt = new Date(Number(payload.expiration || requestedExpiration)).toISOString();
  const { error } = await adminClient.from("calendar_integrations").update({
    watch_channel_id: channelId,
    watch_resource_id: payload.resourceId,
    watch_token_hash: await sha256(channelToken),
    watch_expires_at: expiresAt,
  }).eq("id", integration.id);
  if (error) throw new SafeError("O canal foi criado, mas não pôde ser registrado.", 500);
  return { channel_id: channelId, resource_id: payload.resourceId, expires_at: expiresAt };
}

export async function renewWatch(integrationOrId: string | Record<string, unknown>) {
  const integration = typeof integrationOrId === "string"
    ? await getIntegrationById(integrationOrId)
    : integrationOrId;
  const oldWatch = { ...integration };
  const created = await startWatch(integration);
  try {
    await stopWatch(oldWatch);
  } catch (_) {
    // O novo canal ja esta ativo; falha ao encerrar o antigo nao invalida a renovacao.
  }
  return created;
}

export async function selectGoogleCalendar(userId: string, calendarId: string) {
  if (!calendarId || calendarId.length > 1024) throw new SafeError("Calendário inválido.", 400);
  const integration = await getIntegrationForUser(userId);
  if (!integration || integration.status === "disconnected") throw new SafeError("Conecte sua conta Google primeiro.", 400);
  const calendars = await listGoogleCalendars(userId);
  const selected = calendars.find((calendar) => calendar.id === calendarId);
  if (!selected) throw new SafeError("Calendário não encontrado ou sem permissão de leitura.", 404);

  if (integration.calendar_id && integration.calendar_id !== calendarId) {
    try { await stopWatch(integration); } catch (_) { /* troca continua sem bloquear */ }
    await adminClient.from("events").update({ is_active: false, is_published: false })
      .eq("source", "google")
      .eq("external_calendar_id", integration.calendar_id);
  }

  const { data: updated, error } = await adminClient.from("calendar_integrations").update({
    calendar_id: selected.id,
    calendar_name: selected.name,
    calendar_timezone: selected.timezone,
    sync_token: null,
    status: "active",
    last_error: null,
    watch_channel_id: null,
    watch_resource_id: null,
    watch_token_hash: null,
    watch_expires_at: null,
  }).eq("id", integration.id).select("*").single();
  if (error) throw new SafeError("Não foi possível selecionar o calendário.", 500);
  const sync = await syncGoogleCalendar(updated, true);
  await startWatch(await getIntegrationById(updated.id));
  return { integration: safeIntegration(await getIntegrationById(updated.id)), sync };
}

export async function disconnectGoogleCalendar(userId: string) {
  const integration = await getIntegrationForUser(userId);
  if (!integration) return null;
  try { await stopWatch(integration); } catch (_) { /* desconexao local continua */ }
  if (integration.calendar_id) {
    await adminClient.from("events").update({ is_active: false, is_published: false })
      .eq("source", "google")
      .eq("external_calendar_id", integration.calendar_id);
  }
  const { error: vaultError } = await adminClient.rpc("delete_google_calendar_refresh_token", {
    target_user_id: userId,
  });
  if (vaultError) throw new SafeError("Não foi possível remover a credencial protegida.", 500);
  const { data, error } = await adminClient.from("calendar_integrations").update({
    status: "disconnected",
    sync_token: null,
    last_error: null,
    watch_channel_id: null,
    watch_resource_id: null,
    watch_token_hash: null,
    watch_expires_at: null,
  }).eq("id", integration.id).select("*").single();
  if (error) throw new SafeError("Não foi possível concluir a desconexão.", 500);
  return safeIntegration(data);
}

export function adminReturnUrl(status: "connected" | "error", message?: string) {
  const url = new URL(requiredEnv("ADPEL_ADMIN_URL"));
  url.searchParams.set("google_calendar", status);
  if (message) url.searchParams.set("google_calendar_message", message.slice(0, 200));
  return url.toString();
}
