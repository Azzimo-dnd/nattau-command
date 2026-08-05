import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const redirectTo = new URL(next, request.url);
  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });

    if (!error) {
      return NextResponse.redirect(redirectTo, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(redirectTo, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
  }

  const errorUrl = new URL("/campaign-invite", request.url);
  errorUrl.searchParams.set("error", "confirmation_failed");
  return NextResponse.redirect(errorUrl, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
