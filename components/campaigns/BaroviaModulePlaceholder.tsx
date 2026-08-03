import Link from "next/link";

export function BaroviaModulePlaceholder({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 xl:px-8">
      <section className="relative overflow-hidden rounded-[30px] border border-[#713143]/55 bg-[#150e13]/90 p-6 shadow-2xl sm:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_14%,rgba(126,35,57,0.38),transparent_37%)]" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.38em] text-[#a65b6e]">
            {eyebrow}
          </p>
          <h1 className="mt-4 font-serif text-4xl font-black text-[#efe0d5] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-[#b4a9ad] sm:text-base">
            {description}
          </p>

          <div className="mt-8 rounded-2xl border border-[#4c2934] bg-black/20 p-5">
            <p className="text-sm font-semibold text-[#d4b4bc]">
              Foundation preview
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Membership and the Barovia layout are ready. Campaign-specific data
              will be connected after the login and visual tests are approved.
            </p>
          </div>

          <Link
            href="/campaigns/barovia"
            className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl border border-[#713143] bg-[#35151f]/70 px-5 text-sm font-bold text-[#dfacb8] transition hover:border-[#a65369] hover:text-[#f0d4da]"
          >
            ← Return beyond the mists
          </Link>
        </div>
      </section>
    </main>
  );
}
