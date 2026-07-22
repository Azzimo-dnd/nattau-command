import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default async function AccountPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name, role, created_at")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-slate-100">
      <Link
        href="/"
        className="inline-flex rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-sm text-slate-300 transition hover:border-yellow-600/40 hover:text-yellow-300"
      >
        ← Back to Command Center
      </Link>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <p className="text-xs uppercase tracking-[0.35em] text-yellow-500">
          Player Account
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          {profile?.display_name ?? "Adventurer"}
        </h1>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-sm text-slate-500">Email</p>
            <p className="mt-2 font-medium text-slate-200">
              {user.email}
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <p className="text-sm text-slate-500">Role</p>
            <p className="mt-2 font-bold uppercase text-yellow-400">
              {profile?.role ?? "player"}
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Profile could not be loaded: {error.message}
          </div>
        )}

        <div className="mt-6">
          <LogoutButton />
        </div>
      </section>
    </main>
  );
}