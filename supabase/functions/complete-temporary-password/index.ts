import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function bearerToken(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  const [scheme, token] = authorization.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "Server authentication is not configured." }, 500);
  }

  const token = bearerToken(req);
  if (!token) {
    return json({ error: "Authentication required." }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);

  if (userError || !user) {
    return json({ error: "Your session is invalid or expired." }, 401);
  }

  if (user.app_metadata?.requires_password_change !== true) {
    return json({ error: "This account is not using a temporary password." }, 409);
  }

  let password = "";
  try {
    const payload = (await req.json()) as Record<string, unknown>;
    password = typeof payload.password === "string" ? payload.password : "";
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  if (password.length < 10) {
    return json({ error: "Use at least 10 characters for your new password." }, 400);
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password,
    app_metadata: {
      ...user.app_metadata,
      requires_password_change: false,
    },
  });

  if (updateError) {
    return json({ error: updateError.message }, 400);
  }

  return json({ ok: true });
});
