import {
  SafeError,
  adminReturnUrl,
  consumeOAuthState,
  exchangeAuthorizationCode,
  saveOAuthGrant,
} from "../_shared/google-calendar.ts";

Deno.serve(async (req) => {
  try {
    if (req.method !== "GET") throw new SafeError("Método não permitido.", 405);
    const url = new URL(req.url);
    const state = url.searchParams.get("state") || "";
    const oauthState = await consumeOAuthState(state);
    if (url.searchParams.get("error")) {
      return Response.redirect(adminReturnUrl("error", "A autorização do Google foi cancelada."), 302);
    }
    const grant = await exchangeAuthorizationCode(
      url.searchParams.get("code") || "",
      oauthState.code_verifier,
    );
    await saveOAuthGrant(oauthState.user_id, grant);
    return Response.redirect(adminReturnUrl("connected"), 302);
  } catch (error) {
    const message = error instanceof SafeError ? error.message : "Falha ao concluir a autorização do Google.";
    try {
      return Response.redirect(adminReturnUrl("error", message), 302);
    } catch (_) {
      return new Response("Não foi possível concluir a integração do Google Calendar.", { status: 500 });
    }
  }
});
