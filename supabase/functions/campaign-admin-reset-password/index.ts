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
    data: { user: caller },
    error: callerError,
  } = await admin.auth.getUser(token);

  if (callerError || !caller) {
    return json({ error: "Your session is invalid or expired." }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const campaignId =
    typeof payload.campaignId === "string" ? payload.campaignId.trim() : "";
  const userId =
    typeof payload.userId === "string" ? payload.userId.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";
  const requirePasswordChange = payload.requirePasswordChange === true;

  if (!campaignId || !userId) {
    return json({ error: "Campaign and user are required." }, 400);
  }

  if (password.length < 10) {
    return json({ error: "Password must contain at least 10 characters." }, 400);
  }

  const { data: callerMembership, error: callerMembershipError } = await admin
    .from("campaign_members")
    .select("role,is_active")
    .eq("campaign_id", campaignId)
    .eq("user_id", caller.id)
    .maybeSingle();

  if (
    callerMembershipError ||
    !callerMembership ||
    callerMembership.role !== "dm" ||
    callerMembership.is_active !== true
  ) {
    return json({ error: "Only an active Game Master can reset campaign member passwords." }, 403);
  }

  const { data: targetMembership, error: targetMembershipError } = await admin
    .from("campaign_members")
    .select("user_id,is_active")
    .eq("campaign_id", campaignId)
    .eq("user_id", userId)
    .maybeSingle();

  if (targetMembershipError || !targetMembership) {
    return json({ error: "This user is not a member of the selected campaign." }, 404);
  }

  const { data: target, error: targetError } =
    await admin.auth.admin.getUserById(userId);

  if (targetError || !target.user) {
    return json({ error: "The Auth account could not be found." }, 404);
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password,
    app_metadata: {
      ...target.user.app_metadata,
      requires_password_change: requirePasswordChange,
    },
  });

  if (updateError) {
    return json({ error: updateError.message }, 400);
  }

  return json({
    ok: true,
    requiresPasswordChange: requirePasswordChange,
  });
});
