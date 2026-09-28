import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ campaignSlug: string }> }
) {
  const { campaignSlug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    return NextResponse.json(
      { error: "Your session is invalid or expired." },
      { status: 401 }
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (payload.campaignSlug !== campaignSlug) {
    return NextResponse.json({ error: "Campaign mismatch." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 500 }
    );
  }

  let edgeResponse: Response;
  try {
    edgeResponse = await fetch(
      `${supabaseUrl}/functions/v1/campaign-admin-reset-password`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaignId: payload.campaignId,
          userId: payload.userId,
          password: payload.password,
          requirePasswordChange: payload.requirePasswordChange === true,
        }),
        cache: "no-store",
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Password service could not be reached. Please try again." },
      { status: 502 }
    );
  }

  const raw = await edgeResponse.text();
  let body: unknown;

  try {
    body = raw ? JSON.parse(raw) : { ok: edgeResponse.ok };
  } catch {
    body = edgeResponse.ok
      ? { ok: true }
      : { error: "Password service returned an invalid response." };
  }

  return NextResponse.json(body, { status: edgeResponse.status });
}
