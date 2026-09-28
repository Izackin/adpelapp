import {
  corsHeaders,
  createOAuthAuthorization,
  errorResponse,
  jsonResponse,
  requireMaster,
} from "../_shared/google-calendar.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método não permitido." }, 405);
  try {
    const user = await requireMaster(req);
    return jsonResponse({ authorization_url: await createOAuthAuthorization(user.id) });
  } catch (error) {
    return errorResponse(error);
  }
});
