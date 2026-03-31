import { corsHeaders } from "../_shared/cors.ts";
import { badRequest, deriveResolveResult, jsonResponse, readJson, validateResolvePlaceRequest } from "../_shared/utils.ts";
import type { ResolvePlaceRequest } from "../_shared/types.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const payload = await readJson<ResolvePlaceRequest>(request);
  const errors = validateResolvePlaceRequest(payload);
  if (errors.length > 0) {
    return badRequest(errors.join(", "));
  }

  return jsonResponse(deriveResolveResult(payload));
});
