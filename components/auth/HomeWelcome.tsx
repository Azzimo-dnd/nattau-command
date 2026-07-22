import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SessionCountdown } from "@/components/SessionCountdown";

export async function HomeWelcome() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, role")
    .eq("id", user.id)
    .single();

  const displayName =
    profile?.display_name ??
    user.email?.split("@")[0] ??
    "Adventurer";

  const welcomeLabel =
    profile?.role === "dm"
      ? "Welcome Back, Commander"
      : "Welcome Back, Adventurer";

  return (
    <section className="overflow-hidden rounded-2xl border border-yellow-600/20 bg-slate-900">
      <div className="border-b border-slate-800 bg-gradient-to-r from-yellow-500/10 via-slate-900 to-slate-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
              {welcomeLabel}
            </p>

            <h1 className="mt-3 text-3xl font-black text-slate-100 md:text-4xl">
              Welcome, {displayName}
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Time until the next session:
            </p>
          </div>

          <Link
            href="/account"
            className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-300 transition hover:border-yellow-600/40 hover:text-yellow-300"
          >
            Account
          </Link>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Your profile could not be loaded. Using account data instead.
          </div>
        )}
      </div>

      <div className="p-5">
        <SessionCountdown />
      </div>
    </section>
  );
}