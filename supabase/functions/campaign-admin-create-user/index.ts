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
  const email =
    typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password =
    typeof payload.password === "string" ? payload.password : "";
  const displayName =
    typeof payload.displayName === "string" ? payload.displayName.trim() : "";
  const role = payload.role === "dm" ? "dm" : payload.role === "player" ? "player" : null;
  const planningEnabled = payload.planningEnabled !== false;
  const countsTowardProgress = payload.countsTowardProgress !== false;

  if (!campaignId) {
    return json({ error: "Campaign is required." }, 400);
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return json({ error: "Enter a valid email address." }, 400);
  }
  if (password.length < 10) {
    return json({ error: "Temporary password must contain at least 10 characters." }, 400);
  }
  if (!role) {
    return json({ error: "Choose a valid campaign role." }, 400);
  }
  if (displayName.length > 80) {
    return json({ error: "Display name must be 80 characters or fewer." }, 400);
  }

  const { data: callerMembership, error: membershipError } = await admin
    .from("campaign_members")
    .select("role,is_active")
    .eq("campaign_id", campaignId)
    .eq("user_id", caller.id)
    .maybeSingle();

  if (
    membershipError ||
    !callerMembership ||
    callerMembership.role !== "dm" ||
    callerMembership.is_active !== true
  ) {
    return json({ error: "Only an active Game Master can create campaign accounts." }, 403);
  }

  const resolvedDisplayName =
    displayName || email.split("@")[0] || "New player";

  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: resolvedDisplayName,
      },
      app_metadata: {
        requires_password_change: true,
        created_by_campaign_admin: true,
      },
    });

  if (createError || !created.user) {
    const message = createError?.message ?? "Could not create the account.";
    const duplicate =
      /already|registered|exists/i.test(message);
    return json(
      {
        error: duplicate
          ? "An account already exists for this email address. Use the existing member controls or an invitation instead of creating a second account."
          : message,
      },
      duplicate ? 409 : 400
    );
  }

  const userId = created.user.id;
  const now = new Date().toISOString();

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      display_name: resolvedDisplayName,
      role,
      planning_enabled: planningEnabled,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return json({ error: "The Auth account was created, but its profile could not be created." }, 500);
  }

  const { error: campaignMemberError } = await admin
    .from("campaign_members")
    .insert({
      campaign_id: campaignId,
      user_id: userId,
      role,
      planning_enabled: planningEnabled,
      counts_toward_campaign_progress: countsTowardProgress,
      is_test_account: false,
      is_active: true,
      joined_at: now,
      last_seen_at: null,
      updated_at: now,
    });

  if (campaignMemberError) {
    await admin.auth.admin.deleteUser(userId);
    return json({ error: "The Auth account was created, but campaign access could not be granted." }, 500);
  }

  return json({
    member: {
      userId,
      displayName: resolvedDisplayName,
      email,
      role,
      planningEnabled,
      countsTowardProgress,
      isTestAccount: false,
      isActive: true,
      joinedAt: now,
      lastSeenAt: null,
    },
    requiresPasswordChange: true,
  });
});
