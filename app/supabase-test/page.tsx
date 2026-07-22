import { createClient } from "@/lib/supabase/server";

export default async function SupabaseTestPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 text-slate-100">
      <h1 className="text-3xl font-bold text-yellow-500">Supabase Test</h1>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <p className="text-sm text-slate-400">Connection status</p>

        <p className="mt-2 text-xl font-bold">
          {error ? "Connected, but no user session yet." : "Connected."}
        </p>

        <pre className="mt-4 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-300">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </main>
  );
}