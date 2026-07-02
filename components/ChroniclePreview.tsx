const entries = [
  "Kainalia have begun in UĆ.",
  "Scouts report increased Imperial movement near the House of the Guardian.",
  "Magical cabbage reserves have been sabotaged.",
];

export function ChroniclePreview() {
  return (
    <section id="chronicle" className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h2 className="mb-4 text-2xl font-bold text-yellow-500">
        Latest Chronicle
      </h2>

      <div className="space-y-3 text-sm text-slate-300">
        {entries.map((entry) => (
          <p key={entry}>• {entry}</p>
        ))}
      </div>
    </section>
  );
}